PERT.Project = class Project
{
    /**
     * @param {String} name
     * @param {DataStore} config
     * @param {PERT} pert
     */
    constructor(name, config, pert)
    {
        this.name = name;
        this.config = config;
        this.pert = pert;
        if (!this.config.has('stats')) {
            Object.assign(this.configData, {
                resources: {},
                nodes: {},
                edges: {},
                stats: {
                    accessedAt: null,
                    modifiedAt: null,
                    createdAt: Date.now()
                },
                start: '',
                end: ''
            });
        }

        PERT.ui('area').innerHTML = '';
        PERT.ui('menu-contents').classList.add('menu-contents-project-loaded');

        const configData = this.configData;
        const projectMenu = PERT.ui('menu-contents-project');

        const template = PERT.ui('templates').import.getElementById('ProjectTemplate').content;
        const project = document.importNode(template, true).firstElementChild;

        projectMenu.innerHTML = '';
        projectMenu.appendChild(project);

        const dates = project.querySelectorAll('.project-dates input');
        dates[0].value = configData.start;
        dates[1].value = configData.end;

        dates.forEach((node, index) => {
            const name = index ? 'end' : 'start';
            node.addEventListener('change', e => {
                configData[name] = e.target.value;
                this.recalculateDateConstraints();
            });
        });

        for (const id in configData.resources) {
            this.createResourceInputs(id);
        }
        this.createResourceInputs();

        for (const id in configData.nodes) {
            this.drawNode(id);
        }
        this.recalculateDateConstraints();
        this.redrawEdges();

        this.configData.stats.accessedAt = Date.now();
        this.save();
    }

    /**
     * @returns {Object}
     */
    get configData()
    {
        return this.config.getData();
    }

    /**
     * @returns {Object}
     */
    get originalConfig()
    {
        return this.config.getPointers()[0];
    }

    save()
    {
        this.config.get('stats').modifiedAt = Date.now();
        this.config.commit();
    }

    /**
     * @param {String} name
     */
    addNode(name)
    {
        const nodes = this.config.ns('nodes');
        const id = nodes.findFreeKey('n');

        const top = 200;
        let left = 400;
        for (const nodeId of nodes.keys()) {
            const nodeElement = document.getElementById(nodeId);
            const node = nodes.get(nodeId);
            left = Math.max(left, node.left + nodeElement.clientWidth + 20);
        }
        nodes.set(id, {name, top, left, resources: {}, critical: false, start: '', end: ''});

        this.drawNode(id);
        this.recalculateDateConstraints();
    }

    /**
     * @param {String} id
     */
    deleteNode(id)
    {
        const node = document.getElementById(id);
        node.parentNode.removeChild(node);
        this.config.ns('nodes').unset(id);
        const edges = this.config.ns('edges');
        for (const edgeId of edges.keys()) {
            const edge = edges.get(edgeId);
            if (edge.from === id || edge.to === id) {
                this.deleteEdge(edgeId);
            }
        }
        this.recalculateDateConstraints();
        this.recaculateResourceConstraints();
    }

    /**
     * @param {String} id
     */
    drawNode(id)
    {
        const template = PERT.ui('templates').import.getElementById('NodeTemplate').content;
        const node = document.importNode(template, true).firstElementChild;
        const config = this.config.ns('nodes').get(id);
        node.id = id;
        node.style.top = `${config.top}px`;
        node.style.left = `${config.left}px`;
        if (config.critical) {
            node.classList.add('critical');
        }

        const input = node.querySelector('.node-name');
        const deleteButton = node.querySelector('.node-delete');
        const drag = node.querySelector('.node-drag');
        const critical = node.querySelector('.node-critical');
        const edgeLink = node.querySelector('.node-edge');
        const dates = node.querySelectorAll('.node-dates input');

        input.value = config.name;
        if (!config.start) {
            dates[0].className = 'empty';
        }
        if (!config.end) {
            dates[1].className = 'empty';
        }
        dates[0].value = config.start;
        dates[1].value = config.end;

        PERT.ui('area').appendChild(node);

        this.updateNode(id);

        input.addEventListener('change', e => {
            if (e.target.value === '') {
                alert('Milestone name cannot be empty.');
                e.target.value = config.name;
            } else {
                config.name = e.target.value;
            }
        });

        deleteButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete the selected milestone?')) {
                this.deleteNode(id);
            }
        });

        drag.addEventListener('mousedown', e => {
            this.moveNode = {
                top: e.clientY,
                left: e.clientX,
                originalTop: config.top,
                originalLeft: config.left,
                node,
                config
            };
            e.preventDefault();
        });

        node.addEventListener('dragover', e => {
            const originalId = e.dataTransfer.types.filter(v => v !== 'id' && v !== 'edgeid').pop();
            let element = e.target;
            while (element && !element.classList.contains('node')) {
                element = element.parentNode;
            }
            if (element && originalId === id) {
                return;
            }
            const edges = this.config.get('edges');
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
            this.config.ns('edges').set(e.dataTransfer.getData('edgeid'), {
                from: e.dataTransfer.getData('id'),
                to: id
            });
            this.drawEdge(e.dataTransfer.getData('edgeid'));
        });

        critical.addEventListener('click', () => {
            if (config.critical) {
                node.classList.remove('critical');
                config.critical = false;
            } else {
                node.classList.add('critical');
                config.critical = true;
            }
            this.redrawEdges();
            this.recaculateResourceConstraints();
        });

        edgeLink.addEventListener('dragstart', e => {
            const edgeId = this.config.ns('edges').findFreeKey('e');
            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.setData(id, id);
            e.dataTransfer.setData('id', id);
            e.dataTransfer.setData('edgeid', edgeId);
            e.dataTransfer.setDragImage(new Image(), 0, 0);
            const xOffset = config.left + node.clientWidth,
                yOffset = config.top + node.clientHeight / 2;
            e.target.redrawEdge = (x, y) => {
                const edge = this.createEdge(xOffset, yOffset, x, y, edgeId);
                edge.classList.add('edge-moving');
                if (!node.newedge) {
                    node.newedge = edge;
                    PERT.ui('area').appendChild(edge);
                }
            };
        });

        edgeLink.addEventListener('dragend', e => {
            e.dataTransfer.clearData();
            window.requestAnimationFrame(() => {
                if (!this.config.ns('edges').has(node.newedge.id)) {
                    PERT.ui('area').removeChild(node.newedge);
                }
                node.newedge.classList.remove('edge-moving');
                delete node.newedge;
                delete node.redrawEdge;
            });
        });

        dates.forEach((node, index) => {
            const name = index ? 'end' : 'start';
            node.addEventListener('change', e => {
                config[name] = e.target.value;
                if (config[name]) {
                    e.target.classList.remove('empty');
                } else {
                    e.target.classList.add('empty');
                }
                this.recalculateDateConstraints();
            });
        });
    }

    /**
     * @param {String} nodeId
     * @param {Boolean} [backwards=false]
     * @param {Boolean} [recursive=false]
     * @returns {String[]}
     */
    getNeighbours(nodeId, backwards, recursive)
    {
        const edges = this.config.get('edges');
        const neighbours = [];
        for (const edgeId in edges) {
            if (backwards && edges[edgeId].to === nodeId) {
                neighbours.push(edges[edgeId].from);
            } else if (!backwards && edges[edgeId].from === nodeId) {
                neighbours.push(edges[edgeId].to);
            }
        }
        if (recursive) {
            return Array.from(
                new Set(
                    neighbours.concat(
                        ...neighbours.map(neighbour => this.getNeighbours(neighbour, backwards, recursive))
                    )
                )
            );
        }
        return neighbours;
    }

    /**
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} x2
     * @param {Number} y2
     * @param {String} [id]
     * @returns {HTMLDivElement}
     */
    createEdge(x1, y1, x2, y2, id)
    {
        const edge = document.getElementById(id) || document.createElement('div');
        if (!edge.classList.contains('edge')) {
            edge.classList.add('edge');
            edge.id = id;
            edge.addEventListener('click', () => this.deleteEdge(id));
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        edge.style.top = `${y1}px`;
        edge.style.left = `${x1}px`;
        edge.style.width = `${Math.sqrt(dx*dx + dy*dy)}px`;
        edge.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        return edge;
    }

    /**
     * @param {String} id
     */
    drawEdge(id)
    {
        const config = this.config.ns('edges').get(id);
        const nodeConfig = this.config.ns('nodes');
        const node1 = nodeConfig.get(config.from);
        const node2 = nodeConfig.get(config.to);
        const nodeElement1 = document.getElementById(config.from);
        const nodeElement2 = document.getElementById(config.to);
        const xOffset = node1.left + nodeElement1.clientWidth,
            yOffset1 = node1.top + nodeElement1.clientHeight / 2,
            yOffset2 = node2.top + nodeElement2.clientHeight / 2;
        const edge = this.createEdge(xOffset, yOffset1, node2.left, yOffset2, id);
        if (node1.critical && node2.critical && !edge.classList.contains('critical')) {
            edge.classList.add('critical');
        } else if (!(node1.critical && node2.critical) && edge.classList.contains('critical')) {
            edge.classList.remove('critical');
        }
        if (!edge.parentNode) {
            PERT.ui('area').appendChild(edge);
        }
    }

    redrawEdges()
    {
        for (const id of this.config.ns('edges').keys()) {
            this.drawEdge(id);
        }
    }

    /**
     * @param {String} id
     */
    deleteEdge(id)
    {
        this.config.ns('edges').unset(id);
        const edge = document.getElementById(id);
        edge.parentNode.removeChild(edge);
    }

    /**
     * @param {String} [id]
     */
    createResourceInputs(id)
    {
        if (typeof id !== 'string') {
            id = this.config.ns('resources').findFreeKey('r');
        }
        const elements = {name: null, amount: null, concurrency: null};
        const config = this.config.ns('resources').getData();
        const resource = document.createElement('div');

        for (const type in elements) {
            elements[type] = document.createElement('input');
            elements[type].type = 'text';
            elements[type].placeholder = type;
            elements[type].value = config[id] ? config[id][type] : '';
            elements[type].addEventListener('change', e => this.updateResource(id, type, e.target));
            resource.appendChild(elements[type]);
        }

        resource.className = 'menu-contents-project-resource';
        PERT.ui('menu-contents-project').querySelector('.project-resources').appendChild(resource);
    }

    /**
     * @param {String} id
     * @param {String} type
     * @param {HTMLElement} element
     */
    updateResource(id, type, element)
    {
        const resources = this.config.ns('resources');
        let value = element.value;
        if (type !== 'name') {
            value = Math.max(0, parseFloat(value) || 0);
        }
        if (!resources.has(id)) {
            resources.set(id, {name: null, amount: null, concurrency: null});
            this.createResourceInputs();
        }
        if (type === 'name' && value === '') {
            if (confirm('Are you sure you want to delete this resource?')) {
                resources.unset(id);
                element.parentNode.parentNode.removeChild(element.parentNode);
            } else {
                element.value = resources.get(id)[type];
            }
        } else {
            element.value = resources.get(id)[type] = value;
        }
        this.updateNodes();
    }

    recalculateDateConstraints()
    {
        const nodes = this.config.get('nodes');
        const edges = this.config.get('edges');
        const nodeInputs = {project: PERT.ui('menu-contents-project').querySelectorAll('.project-dates input')};
        nodeInputs.project[0].min = '';
        nodeInputs.project[0].max = '';
        nodeInputs.project[1].min = '';
        nodeInputs.project[1].max = '';

        const left = [], right = [];
        for (const nodeId in nodes) {
            nodeInputs[nodeId] = document.getElementById(nodeId).querySelectorAll('.node-dates input');
            nodeInputs[nodeId][0].min = '';
            nodeInputs[nodeId][0].max = '';
            nodeInputs[nodeId][1].min = '';
            nodeInputs[nodeId][1].max = '';

            let isFirst = true, isLast = true;
            for (const edgeId in edges) {
                const edge = edges[edgeId];
                if (edge.from === nodeId) {
                    isLast = false;
                } else if (edge.to === nodeId) {
                    isFirst = false;
                }
            }
            if (isFirst) {
                left.push(nodeId);
            }
            if (isLast) {
                right.push(nodeId);
            }
        }
        const updateConstraints = (nodeId, backwards, limit) => {
            const neighbours = this.getNeighbours(nodeId, backwards);
            const inputs = nodeInputs[nodeId];
            const node = nodes[nodeId];
            if (backwards) {
                if (inputs[1].max && (!limit || inputs[1].max < limit)) {
                    limit = inputs[1].max;
                }
                inputs[1].max = limit;
                inputs[0].max = node.end || inputs[1].max;
                limit = node.start || inputs[0].max;
            } else {
                if (inputs[0].min && (!limit || inputs[0].min > limit)) {
                    limit = inputs[0].min;
                }
                inputs[0].min = limit;
                inputs[1].min = node.start || inputs[0].min;
                limit = node.end || inputs[1].min;
            }
            neighbours.forEach(neighbour => updateConstraints(neighbour, backwards, limit));
        };
        left.forEach(nodeId => updateConstraints(nodeId, false, nodeInputs.project[0].value));
        right.forEach(nodeId => updateConstraints(nodeId, true, nodeInputs.project[1].value));

        left.forEach(nodeId => {
            const value = nodeInputs[nodeId][0].value || nodeInputs[nodeId][1].value || nodeInputs[nodeId][1].max;
            if (!nodeInputs.project[0].max || (value && nodeInputs.project[0].max > value)) {
                nodeInputs.project[0].max = value;
            }
        });
        right.forEach(nodeId => {
            const value = nodeInputs[nodeId][1].value || nodeInputs[nodeId][0].value || nodeInputs[nodeId][0].min;
            if (!nodeInputs.project[1].min || (value && nodeInputs.project[1].min < value)) {
                nodeInputs.project[1].min = value;
            }
        });
        this.recaculateResourceConstraints();
    }

    recaculateResourceConstraints()
    {
        const nodes = this.config.get('nodes');
        const edges = this.config.get('edges');
        const nodesOrdered = this
            .config
            .ns('nodes')
            .keys()
            .sort((a, b) => (nodes[a].start || nodes[a].end) > (nodes[b].start || nodes[b].end) ? 1 : -1);
        const resources = this.config.get('resources');
        const resourcesLeft = {}, concurrencies = {};
        const events = [];
        for (const resourceId in resources) {
            resourcesLeft[resourceId] = resources[resourceId].amount;
            concurrencies[resourceId] = resources[resourceId].concurrency;
        }
        for (const nodeId of nodesOrdered) {
            const node = nodes[nodeId];
            const nodeElement = document.getElementById(nodeId);
            if (!nodeElement) {
                continue;
            }
            const resourceCells = nodeElement.querySelectorAll('.node-resources td');

            nodeElement.classList.remove('red');

            for (const resourceId in node.resources) {
                if (!(resourceId in resources)) {
                    continue;
                }
                resourcesLeft[resourceId] -= node.resources[resourceId];
                const index = Object.keys(node.resources).indexOf(resourceId) * 2;
                if (node.resources[resourceId] && resourcesLeft[resourceId] < 0) {
                    resourceCells[index].classList.add('red');
                    resourceCells[index+1].classList.add('red');
                    nodeElement.classList.add('red');
                } else {
                    resourceCells[index].classList.remove('red');
                    resourceCells[index+1].classList.remove('red');
                }

                if (resources[resourceId].concurrency && node.resources[resourceId]) {
                    const dates = nodeElement.querySelectorAll('.node-dates input');
                    events.push({nodeId, resourceId, start: true, time: dates[0].value || dates[1].min});
                    events.push({nodeId, resourceId, start: false, time: dates[1].value || dates[0].max || 'z'});
                }
            }
        }
        const getLevel = nodeId => {
            for (const edgeId in edges) {
                if (edges[edgeId].to === nodeId) {
                    return getLevel(edges[edgeId].from) + 1;
                }
            }
            return 1;
        };
        events.sort((a, b) => {
            if (a.time !== b.time) {
                return a.time > b.time ? 1 : -1;
            }
            if (a.start !== b.start) {
                return a.start ? 1 : -1;
            }
            if (nodes[a.nodeId].critical !== nodes[b.nodeId].critical) {
                return nodes[a.nodeId].critical ? -1 : 1;
            }
            return getLevel(a.nodeId) > getLevel(b.nodeId) ? 1 : -1;
        }).forEach(({nodeId, resourceId, start}) => {
            concurrencies[resourceId] += start ? -1 : 1;
            if (concurrencies[resourceId] < 0 && start) {
                const node = nodes[nodeId];
                const nodeElement = document.getElementById(nodeId);
                const resourceCells = nodeElement.querySelectorAll('.node-resources td');
                const index = Object.keys(node.resources).indexOf(resourceId) * 2;

                resourceCells[index].classList.add('red');
                resourceCells[index+1].classList.add('red');
                nodeElement.classList.add('red');
            }
        });
    }

    /**
     * @param {String} date
     * @returns {Object}
     */
    costUntil(date)
    {
        const resourcesSpent = {};
        const resources = this.config.get('resources');
        for (const resourceId in resources) {
            resourcesSpent[resourceId] = {name: resources[resourceId].name, value: 0};
        }

        const nodes = this.config.get('nodes');
        for (const nodeId in nodes) {
            if (nodes[nodeId].from > date) {
                continue;
            }
            for (const resourceId in nodes[nodeId].resources) {
                resourcesSpent[resourceId].value += nodes[nodeId].resources[resourceId];
            }
        }
        return resourcesSpent;
    }

    /**
     * @param {String} nodeId
     * @returns {Object}
     */
    costUpTo(nodeId)
    {
        const resourcesSpent = {};
        const resources = this.config.get('resources');
        for (const resourceId in resources) {
            resourcesSpent[resourceId] = {name: resources[resourceId].name, value: 0};
        }

        const nodes = this.config.get('nodes');
        const nodeList = this.getNeighbours(nodeId, true, true).concat(nodeId);
        for (const nodeId of nodeList) {
            for (const resourceId in nodes[nodeId].resources) {
                resourcesSpent[resourceId].value += nodes[nodeId].resources[resourceId];
            }
        }
        return resourcesSpent;
    }

    /**
     * @param {String} [nodeId]
     */
    redrawStats(nodeId)
    {
        const stats = nodeId ? this.costUpTo(nodeId) : this.costUntil(this.config.get('end'));
        const statArea = PERT.ui('menu-contents-project').querySelector('.project-stats');

        statArea.innerHTML = '';
        for (const key in stats) {
            const row = document.createElement('tr');
            [stats[key].name, stats[key].value]
                .map(value => {
                    const td = document.createElement('td');
                    td.innerText = value;
                    return td;
                })
                .forEach(td => row.appendChild(td));
            statArea.appendChild(row);
        }
    }

    /**
     * @param {String} id
     */
    updateNode(id)
    {
        const resources = document.getElementById(id).querySelector('.node-resources');
        const config = this.config.get('resources');
        const nodeResources = this.config.ns('nodes').ns(id).get('resources');

        resources.innerHTML = '';

        for (const resourceId in nodeResources) {
            if (!(resourceId in config)) {
                delete nodeResources[resourceId];
            }
        }

        const resourcesPerRow = Math.floor(((Object.keys(config).length || 1) - 1) / 3) + 1;
        let i = 0;
        let row = null;
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
                this.recaculateResourceConstraints();
            });
        }
        this.recaculateResourceConstraints();
    }

    updateNodes()
    {
        for (const id of this.config.ns('nodes').keys()) {
            this.updateNode(id);
        }
    }
};
