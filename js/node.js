PERT.Node = class Node
{
    constructor(id, configStore, name)
    {
        this.id = id;
        this.config = configStore;
        const config = this.configData;

        // Default configuration for new nodes
        if (!this.config.keys().length) {
            const nodes = PERT.currentProject.config.ns('nodes');
            const top = 200;
            let left = 400;

            // Calculate the left offset based on the node furthest to the right
            for (const nodeId of nodes.keys()) {
                if (nodeId !== id) {
                    const nodeElement = document.getElementById(nodeId);
                    const node = nodes.get(nodeId);
                    left = Math.max(left, node.left + nodeElement.clientWidth + 20);
                }
            }
            Object.assign(config, {
                name,
                top,
                left,
                resources: {},
                critical: false,
                start: '',
                end: ''
            });
        }

        this.neighbours = {back: {}, forward: {}};

        // Setup node UI
        const template = PERT.ui('templates').import.getElementById('NodeTemplate').content;
        const node = document.importNode(template, true).firstElementChild;
        this.node = node;

        node.id = id;
        node.style.top = `${config.top}px`;
        node.style.left = `${config.left}px`;
        if (config.critical) {
            node.classList.add('critical');
        }

        const deleteButton = node.querySelector('.node-delete');
        const critical = node.querySelector('.node-critical');
        const edgeLink = node.querySelector('.node-edge');
        this.dragNode = node.querySelector('.node-drag');
        this.dateInputs = node.querySelectorAll('.node-dates input');
        this.nameInput = node.querySelector('.node-name');

        this.nameInput.value = config.name;
        if (!config.start) {
            this.dateInputs[0].className = 'empty';
        }
        if (!config.end) {
            this.dateInputs[1].className = 'empty';
        }
        this.dateInputs[0].value = config.start;
        this.dateInputs[1].value = config.end;

        PERT.ui('area').querySelector('.project-area').appendChild(node);

        this.update();

        // Name change
        this.nameInput.addEventListener('change', e => this.rename(e.target.value));

        // Register UI button handlers
        critical.addEventListener('click', () => this.toggleCritical());
        deleteButton.addEventListener('click', () => this.delete());

        // Drag start
        this.dragNode.addEventListener('mousedown', e => {
            PERT.currentProject.moveNode = this;
            e.preventDefault();
        });

        // Edge drag handlers
        node.addEventListener('dragover', e => {
            const originalId = e.dataTransfer.types.filter(v => v !== 'id' && v !== 'edgeId').pop();

            // Prevent same the source and target
            if (originalId === id) {
                return;
            }
            const edges = PERT.currentProject.config.get('edges');

            // Prevent the source node from being earlier than the target
            const upperLimit = this.dateInputs[0].value || this.dateInputs[0].max;
            if (upperLimit) {
                const source = PERT.currentProject.nodes[originalId];
                const lowerLimit = source.dateInputs[1].value || source.dateInputs[1].min;
                if (lowerLimit && lowerLimit > upperLimit) {
                    return;
                }
            }

            // Prevent creating loops
            const loops = (from, direct) => {
                for (const edgeId in edges) {
                    const edge = edges[edgeId];
                    if (direct && edge.from === from && edge.to === id) {
                        return true;
                    } else if (direct && loops(id)) {
                        return true;
                    } else if (!direct && edge.from === from && (edge.to === originalId || loops(edge.to))) {
                        return true;
                    }
                }
                return false;
            };
            if (!loops(originalId, true)) {
                e.preventDefault();
            }
        });

        node.addEventListener('drop', e => {
            const from = e.dataTransfer.getData('id');
            const edgeId = e.dataTransfer.getData('edgeId');
            PERT.currentProject.config.ns('edges').set(edgeId, {from, to: id});
            PERT.currentProject.nodes[from].connect(edgeId, PERT.currentProject.nodes[id]);
            PERT.currentProject.recalculateDateConstraints();
        });

        edgeLink.addEventListener('dragstart', e => {
            const edgeId = PERT.currentProject.config.ns('edges').findFreeKey('e');
            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.setData(id, id);
            e.dataTransfer.setData('id', id);
            e.dataTransfer.setData('edgeId', edgeId);
            e.dataTransfer.setDragImage(new Image(), 0, 0);

            // Append a custom edge redraw handler
            e.target.redrawEdge = (x, y) => {
                const edge = PERT.currentProject.nodes[id].createEdge(x, y, edgeId);
                edge.classList.add('edge-moving');
                if (!node.newEdge) {
                    node.newEdge = edge;
                    PERT.ui('area').querySelector('.project-area').appendChild(edge);
                }
            };
        });

        edgeLink.addEventListener('dragend', e => {
            e.dataTransfer.clearData();

            // Make all DOM changes in a new frame to prevent drag interruption
            window.requestAnimationFrame(() => {
                if (!PERT.currentProject.config.ns('edges').has(node.newEdge.id)) {
                    node.newEdge.parentNode.removeChild(node.newEdge);
                }
                node.newEdge.classList.remove('edge-moving');
                delete node.newEdge;
                delete node.redrawEdge;
            });
        });

        // Date change handlers
        this.dateInputs.forEach((node, index) => {
            const name = index ? 'end' : 'start';
            node.addEventListener('change', e => {
                config[name] = e.target.value;
                if (config[name]) {
                    e.target.classList.remove('empty');
                } else {
                    e.target.classList.add('empty');
                }
                PERT.currentProject.recalculateDateConstraints();
            });
        });
    }

    /**
     * The plain object representation of the node's configuration DataStore.
     * @returns {Object}
     */
    get configData()
    {
        return this.config.getData();
    }

    /**
     * Opens the node delete dialog and deletes the node.
     */
    delete()
    {
        if (!confirm('Are you sure you want to delete the selected milestone?')) {
            return;
        }
        this.node.parentNode.removeChild(this.node);

        for (const edgeId in this.neighbours.forward) {
            this.disconnect(edgeId);
        }
        for (const edgeId in this.neighbours.back) {
            this.neighbours.back[edgeId].disconnect(edgeId);
        }

        PERT.currentProject.deleteNode(this.id);
    }

    /**
     * Redraws the node resources and recalculates the resource constraints.
     */
    update()
    {
        const resources = this.node.querySelector('.node-resources');
        const nodeResources = this.config.get('resources');
        const config = PERT.currentProject.config.get('resources');

        // Delete the old resource elements and remove any resources from the
        // node configuration that might not exist globally anymore
        resources.innerHTML = '';
        for (const resourceId in nodeResources) {
            if (!(resourceId in config)) {
                delete nodeResources[resourceId];
            }
        }

        // Define the resource grid width, fitting at most 3 items per column
        const resourcesPerRow = Math.floor(((Object.keys(config).length || 1) - 1) / 3) + 1;
        let i = 0;
        let row = null;

        // Regenerate the resource table
        for (const resourceId in config) {
            if (!(resourceId in nodeResources)) {
                nodeResources[resourceId] = 0;
            }
            if (!(i++ % resourcesPerRow)) {
                row = document.createElement('tr');
                resources.appendChild(row);
            }
            const cell1 = document.createElement('td');
            const cell2 = cell1.cloneNode();

            cell1.innerText = config[resourceId].name;
            const input = document.createElement('input');
            input.value = nodeResources[resourceId];
            if (!nodeResources[resourceId]) {
                cell1.className = cell2.className = 'empty';
            }
            cell2.appendChild(input);

            row.appendChild(cell1);
            row.appendChild(cell2);

            input.addEventListener('change', e => {
                nodeResources[resourceId] = e.target.value = parseFloat(e.target.value) || 0;
                cell1.className = cell2.className = (e.target.value === '0' ? 'empty' : '');
                PERT.currentProject.recalculateResourceConstraints();
            });
        }
        PERT.currentProject.recalculateResourceConstraints();
    }

    /**
     * Toggles the critical path.
     */
    toggleCritical()
    {
        const config = this.configData;
        if (config.critical) {
            this.node.classList.remove('critical');
            config.critical = false;
        } else {
            this.node.classList.add('critical');
            config.critical = true;
        }
        this.redrawEdges();
        PERT.currentProject.recalculateResourceConstraints();
    }

    /**
     * Renames the node.
     * @param {String} name
     */
    rename(name)
    {
        if (name === '') {
            alert('Milestone name cannot be empty.');
            this.nameInput.value = this.config.get('name');
        } else {
            this.config.set('name', name);
        }
    }

    /**
     * Moves the node to the specified coordinates, with the origin at the
     * center of the drag handle.
     * @param {Integer} x
     * @param {Integer} y
     */
    drag(x, y)
    {
        const config = this.configData;

        config.top = PERT.round(Math.max(y - (this.dragNode.offsetTop + this.dragNode.offsetHeight/2), 0), 25);
        config.left = PERT.round(Math.max(x - (this.dragNode.offsetLeft + this.dragNode.offsetWidth/2), 0), 25);
        this.node.style.top = `${config.top}px`;
        this.node.style.left = `${config.left}px`;
        this.redrawEdges();
    }

    /**
     * Creates or updates the supplied edge, with the given coordinates,
     * returning its HTML element.
     * @param {Number} x2
     * @param {Number} y2
     * @param {String} [id]
     * @returns {HTMLDivElement}
     */
    createEdge(x2, y2, id)
    {
        const x1 = this.config.get('left') + this.node.clientWidth;
        const y1 = this.config.get('top') + this.node.clientHeight / 2;

        // Find or create an edge
        const edge = document.getElementById(id) || document.createElement('div');
        if (!edge.classList.contains('edge')) {
            edge.classList.add('edge');
            edge.id = id;
            edge.addEventListener('click', () => {
                this.disconnect(id);
                PERT.currentProject.recalculateDateConstraints();
            });
        }

        // Reposition the edge and recalculate its angle
        const dx = x2 - x1;
        const dy = y2 - y1;
        edge.style.top = `${y1}px`;
        edge.style.left = `${x1}px`;
        edge.style.width = `${Math.sqrt(dx*dx + dy*dy)}px`;
        edge.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        return edge;
    }

    /**
     * Draws the specified edge.
     * @param {String} id
     */
    drawEdge(id)
    {
        // Find the target node
        const node = this.neighbours.back[id] || this.neighbours.forward[id];
        const critical = this.config.get('critical');
        const nodeConfig = node.configData;

        // Point to the middle of the left side of the target node
        const yOffset2 = nodeConfig.top + node.node.clientHeight / 2;
        const edge = this.createEdge(nodeConfig.left, yOffset2, id);
        if (critical && nodeConfig.critical && !edge.classList.contains('critical')) {
            edge.classList.add('critical');
        } else if (!(critical && nodeConfig.critical) && edge.classList.contains('critical')) {
            edge.classList.remove('critical');
        }
        if (!edge.parentNode) {
            PERT.ui('area').querySelector('.project-area').appendChild(edge);
        }
    }

    /**
     * Redraws all edges connected to the node.
     */
    redrawEdges()
    {
        for (const edgeId in this.neighbours.forward) {
            this.drawEdge(edgeId);
        }
        for (const edgeId in this.neighbours.back) {
            // Back edges should be redrawn by their origin node
            this.neighbours.back[edgeId].drawEdge(edgeId);
        }
    }

    /**
     * Connects to the supplied node, creating an edge with the given id.
     * @param {String} id
     * @param {PERT.Node} node
     * @param {Boolean} [back=false]
     */
    connect(id, node, back)
    {
        if (back) {
            this.neighbours.back[id] = node;
        } else {
            this.neighbours.forward[id] = node;
            // A reverse connection is made on the target node
            node.connect(id, this, true);
            this.drawEdge(id);
        }
    }

    /**
     * Disconnects from the node linked by the supplied edge, deleting the edge.
     * @param {String} id
     */
    disconnect(id)
    {
        if (id in this.neighbours.forward) {
            // Disconnect the reverse side as well
            this.neighbours.forward[id].disconnect(id);
            delete this.neighbours.forward[id];
            PERT.currentProject.config.ns('edges').unset(id);
            const edge = document.getElementById(id);
            edge.parentNode.removeChild(edge);
        } else {
            delete this.neighbours.back[id];
        }
    }

    /**
     * Returns the connected node neighbours in either the back of forward
     * direction, optionally including all their neighbours recursively.
     * @param {Boolean} [back=false]
     * @param {Boolean} [recursive=false]
     * @returns {PERT.Node[]}
     */
    getNeighbours(back, recursive)
    {
        const neighbours = [];
        const direction = back ? 'back' : 'forward';
        for (const edgeId in this.neighbours[direction]) {
            neighbours.push(this.neighbours[direction][edgeId]);
        }
        if (recursive) {
            return Array.from( // Convert to array
                new Set( // Maintain a unique list of nodes
                    neighbours.concat( // Merge with all neighbours' neighbours
                        ...neighbours.map(neighbour => neighbour.getNeighbours(back, recursive))
                    )
                )
            );
        }
        return neighbours;
    }

    /**
     * Recalculates and sets the limit for the minimum and maximum values for
     * the node, recursively propagating to all neighbour nodes.
     * @param {Boolean} [back=false]
     * @param {String} [limit='']
     */
    updateDateConstraints(back, limit)
    {
        const neighbours = this.getNeighbours(back);
        const inputs = this.dateInputs;
        const node = this.configData;
        if (back) {
            // If the limit is not set, or it is later than the the maximum node
            // end date, set it to that date
            if (inputs[1].max && (!limit || inputs[1].max < limit)) {
                limit = inputs[1].max;
            }

            // The node should not end later than the limit
            inputs[1].max = limit;

            // The node should not start later than its end or the limit
            inputs[0].max = this.node.end || limit;

            // Set the limit to the earliest date available
            limit = node.start || inputs[0].max;
        } else {
            // If the limit is not set, or it is earlier than the the minimum
            // node start date, set it to that date
            if (inputs[0].min && (!limit || inputs[0].min > limit)) {
                limit = inputs[0].min;
            }

            // The node should not start earlier than the limit
            inputs[0].min = limit;

            // The node should not end earlier than its start or the limit
            inputs[1].min = node.start || limit;

            // Set the limit to the latest date available
            limit = node.end || inputs[1].min;
        }
        neighbours.forEach(neighbour => neighbour.updateDateConstraints(back, limit));
    }

    /**
     * Calculates the resources cost of the node, optionally including the sum
     * of all neighbour nodes, this node is dependent on recursively.
     * @param {Boolean} [recursive=false]
     * @returns {Object}
     */
    cost(recursive)
    {
        let resourcesSpent = {};
        const resources = this.config.get('resources');
        for (const resourceId in resources) {
            resourcesSpent[resourceId] = resources[resourceId] || 0;
        }
        if (recursive) {
            const neighbours = this.getNeighbours(true, true);
            resourcesSpent = PERT.sumObjects(resourcesSpent, ...neighbours.map(node => node.cost()));
        }
        return resourcesSpent;
    }

    /**
     * Returns the depth of the node, taking the longest path to a starting
     * node.
     * @returns {Number}
     */
    level()
    {
        return this.getNeighbours(true)
            .reduce((max, nextNode) => Math.max(max, nextNode.level()), 0) + 1;
    }
};
