class PERT
{
    constructor()
    {
        this.config = new DataStore('pert'); // eslint-disable-line no-undef
        this.uiCache = {};
        this.currentProject = null;

        this.initializeUi();

        // Load the last opened project
        const projects = [];
        for (const name of this.config.keys()) {
            const accessedAt = this.config.get(name).stats.accessedAt;
            projects.push({name, accessedAt});
        }
        projects.sort((a, b) => b.accessedAt - a.accessedAt);
        for (const project of projects) {
            this.loadProject(project.name);
            break;
        }
    }

    /**
     * @param {Number} number
     * @param {Number} [precision=0]
     * @returns {Number}
     */
    static round(number, precision)
    {
        const multiplier = Math.pow(10, typeof precision === 'number' ? -precision : 0);
        return multiplier * Math.round(number / multiplier);
    }

    /**
     * @param {String} name
     * @returns {HTMLElement}
     */
    ui(name)
    {
        if (!(name in this.uiCache)) {
            this.uiCache[name] = document.getElementById(name);
        }
        return this.uiCache[name];
    }

    /**
     * @param {String} prefix
     * @param {DataStore} config
     * @returns {String}
     */
    static findFreeKey(prefix, config)
    {
        let key, i=0;
        do {
            key = prefix + (++i);
        } while (config.has(key));
        return key;
    }

    redrawProjectsSelector()
    {
        const select = this.ui('menu-contents-projects');
        select.innerHTML = '<option disabled selected>Load a project</option>';
        for (const project of this.config.keys()) {
            const option = document.createElement('option');
            option.innerText = project;
            option.value = project;
            select.appendChild(option);
        }
    }

    /**
     * @param {String} [action]
     * @param {Boolean} [returnMessage]
     * @returns {Boolean|String}
     */
    shouldStayOnPage(action, returnMessage)
    {
        let message = 'The current project has unsaved changes which will be lost if you continue.';
        if (typeof action === 'string') {
            message += ` ${action}`;
        }
        if (this.config.changed()) {
            return returnMessage ? message : !confirm(message);
        }
        return false;
    }

    /**
     * @param {String} name
     */
    createProject(name)
    {
        this.config.reset();
        this.config.set(name, {});
        this.config.commit();
        this.redrawProjectsSelector();
    }

    /**
     * @param {String} name
     */
    loadProject(name)
    {
        if (this.ui('menu-contents-projects').value !== name) {
            this.ui('menu-contents-projects').value = name;
        }

        this.config.reset();
        this.currentProject = new Project(name, this.config.ns(name)); // eslint-disable-line no-undef

        const area = this.ui('area');
        area.innerHTML = '';

        this.ui('menu-contents').classList.add('menu-contents-project-loaded');

        const config = this.currentProject.configData;
        const projectMenu = this.ui('menu-contents-project');

        const template = this.ui('templates').import.getElementById('ProjectTemplate').content;
        const project = document.importNode(template, true).firstElementChild;

        projectMenu.innerHTML = '';
        projectMenu.appendChild(project);

        const dates = project.querySelectorAll('.project-dates input');
        dates[0].value = config.start;
        dates[1].value = config.end;

        dates.forEach((node, index) => {
            const name = index ? 'end' : 'start';
            node.addEventListener('change', e => {
                config[name] = e.target.value;
                this.recalculateDateConstraints();
            });
        });

        for (const id in config.resources) {
            this.createResourceInputs(id);
        }
        this.createResourceInputs();

        for (const id in config.nodes) {
            this.drawNode(id);
        }
        this.recalculateDateConstraints();

        this.redrawEdges();
    }

    deleteProject()
    {
        this.config.unset(this.currentProject.name);
        this.config.commit();
        window.location.reload();
    }

    /**
     * @param {String} [id]
     */
    createResourceInputs(id)
    {
        if (typeof id !== 'string') {
            id = PERT.findFreeKey('r', this.currentProject.config.ns('resources'));
        }
        const elements = {name: null, amount: null, concurrency: null};
        const config = this.currentProject.config.ns('resources').getData();
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
        this.ui('menu-contents-project').appendChild(resource);
    }

    /**
     * @param {String} id
     * @param {String} type
     * @param {HTMLElement} element
     */
    updateResource(id, type, element)
    {
        const resources = this.currentProject.config.ns('resources');
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
    /**
     * @param {String} name
     */
    addNode(name)
    {
        const nodes = this.currentProject.config.ns('nodes');
        const id = PERT.findFreeKey('n', nodes);

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
        this.currentProject.config.ns('nodes').unset(id);
        const edges = this.currentProject.config.ns('edges');
        for (const edgeId of edges.keys()) {
            const edge = edges.get(edgeId);
            if (edge.from === id || edge.to === id) {
                this.deleteEdge(edgeId);
            }
        }
    }

    /**
     * @param {String} id
     */
    drawNode(id)
    {
        const template = this.ui('templates').import.getElementById('NodeTemplate').content;
        const node = document.importNode(template, true).firstElementChild;
        const config = this.currentProject.config.ns('nodes').get(id);
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

        this.ui('area').appendChild(node);

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
            const edges = this.currentProject.config.get('edges');
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
            this.currentProject.config.ns('edges').set(e.dataTransfer.getData('edgeid'), {
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
        });

        edgeLink.addEventListener('dragstart', e => {
            const edgeId = PERT.findFreeKey('e', this.currentProject.config.ns('edges'));
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
                    this.ui('area').appendChild(edge);
                }
            };
        });

        edgeLink.addEventListener('dragend', e => {
            e.dataTransfer.clearData();
            window.requestAnimationFrame(() => {
                if (!this.currentProject.config.ns('edges').has(node.newedge.id)) {
                    this.ui('area').removeChild(node.newedge);
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

    updateNodes()
    {
        for (const id of this.currentProject.config.ns('nodes').keys()) {
            this.updateNode(id);
        }
    }

    recaculateResourceConstraints()
    {
        const nodes = this.currentProject.config.get('nodes');
        const nodesOrdered = this
            .currentProject
            .config
            .ns('nodes')
            .keys()
            .sort((a, b) => (nodes[a].start || nodes[a].end) > (nodes[b].start || nodes[b].end) ? 1 : -1);
        const resources = this.currentProject.config.get('resources');
        const resourcesLeft = {};
        for (const resourceId in resources) {
            resourcesLeft[resourceId] = resources[resourceId].amount;
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
            }
        }
    }

    recalculateDateConstraints()
    {
        const nodes = this.currentProject.config.get('nodes');
        const edges = this.currentProject.config.get('edges');
        const nodeInputs = {project: this.ui('menu-contents-project').querySelectorAll('.project-dates input')};
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
            const neighbours = [];
            for (const edgeId in edges) {
                if (backwards && edges[edgeId].to === nodeId) {
                    neighbours.push(edges[edgeId].from);
                } else if (!backwards && edges[edgeId].from === nodeId) {
                    neighbours.push(edges[edgeId].to);
                }
            }
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
            if (!nodeInputs.project[0].max || nodeInputs.project[0].max < nodeInputs[nodeId][1].min) {
                nodeInputs.project[0].max = nodeInputs[nodeId][1].min;
            }
        });
        right.forEach(nodeId => {
            if (!nodeInputs.project[1].min || nodeInputs.project[1].min > nodeInputs[nodeId][0].max) {
                nodeInputs.project[1].min = nodeInputs[nodeId][0].max;
            }
        });
    }

    /**
     * @param {String} id
     */
    updateNode(id)
    {
        const resources = document.getElementById(id).querySelector('.node-resources');
        const config = this.currentProject.config.get('resources');
        const nodeResources = this.currentProject.config.ns('nodes').ns(id).get('resources');

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
                nodeResources[resourceId] = e.target.value = Math.max(0, parseFloat(e.target.value) || 0);
                cell1.className = cell2.className = (e.target.value === '0' ? 'empty' : '');
                this.recaculateResourceConstraints();
            });
        }
        this.recaculateResourceConstraints();
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
        const config = this.currentProject.config.ns('edges').get(id);
        const nodeConfig = this.currentProject.config.ns('nodes');
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
            this.ui('area').appendChild(edge);
        }
    }

    redrawEdges()
    {
        for (const id of this.currentProject.config.ns('edges').keys()) {
            this.drawEdge(id);
        }
    }

    /**
     * @param {String} id
     */
    deleteEdge(id)
    {
        this.currentProject.config.ns('edges').unset(id);
        this.ui('area').removeChild(document.getElementById(id));
    }

    /**
     * @param {Boolean} [rename=false]
     * @returns {String|null}
     */
    getNewProjectName(rename)
    {
        if (this.shouldStayOnPage()) {
            return null;
        }

        let promptText = '';
        let newName = rename ? this.currentProject.name : PERT.findFreeKey('Untitled Project ', this.config);
        for (;;) {
            promptText += `Please enter a ${rename ? 'new name for the' : 'name for the new'} project:`;
            newName = prompt(promptText, newName);
            if (newName === null || (rename && newName === this.currentProject.name)) {
                return null;
            } else if (newName === '') {
                promptText = 'The project name cannot be empty.\n';
            } else if (this.config.has(newName)) {
                promptText = 'A project with the selected name already exists.\n';
            } else {
                return newName;
            }
        }
    }

    initializeUi()
    {
        this.ui('menu-collapse').onclick = () => this.ui('menu').classList.toggle('menu-collapsed');

        this.redrawProjectsSelector();

        this.ui('menu-contents-new').addEventListener('click', () => {
            const newName = this.getNewProjectName();

            if (newName !== null) {
                this.createProject(newName);
                this.loadProject(newName);
            }
        });

        this.ui('menu-contents-import').addEventListener('click', () => {
            const newName = this.getNewProjectName();

            if (newName !== null) {
                const file = document.createElement('input');
                file.type = 'file';
                file.accept = '.pert';
                file.addEventListener('change', () => {
                    const reader = new FileReader();

                    reader.addEventListener('load', () => {
                        this.config.reset();
                        this.config.set(newName, JSON.parse(reader.result));
                        this.config.commit();
                        this.redrawProjectsSelector();
                        this.loadProject(newName);
                    }, false);

                    if (file.files.length) {
                        reader.readAsText(file.files[0]);
                    }
                });
                file.click();
            }
        });

        this.ui('menu-contents-rename').addEventListener('click', () => {
            const newName = this.getNewProjectName(true);

            if (newName !== null) {
                this.config.reset();
                this.config.set(newName, this.currentProject.configData);
                this.config.unset(this.currentProject.name);
                this.config.commit();
                this.redrawProjectsSelector();
                this.loadProject(newName);
            }
        });

        this.ui('menu-contents-delete').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete the current project? This action cannot be undone.')) {
                this.deleteProject(name);
            }
        });

        this.ui('menu-contents-save').addEventListener('click', () => this.currentProject.save());

        this.ui('menu-contents-export').addEventListener('click', () => {
            const json = JSON.stringify(this.currentProject.config.getPointers()[0]);
            const blob = new Blob([json], {type: 'application/json'});
            const reader = new FileReader();
            reader.addEventListener('load', e => {
                const link = document.createElement('a');
                link.download = `${this.currentProject.name}.pert`;
                link.href = e.target.result;
                link.click();
            });
            reader.readAsDataURL(blob);
        });

        this.ui('menu-contents-add-node').addEventListener('click', () => {
            let newName, promptText = '';
            for (;;) {
                promptText += 'Please enter a name for the new milestone:';
                newName = prompt(promptText, newName);
                if (newName === null) {
                    return;
                } else if (newName === '') {
                    promptText = 'The new milestone name cannot be empty.\n';
                } else {
                    break;
                }
            }
            this.addNode(newName);
        });

        this.ui('menu-contents-projects').addEventListener('change', e => {
            if (this.shouldStayOnPage()) {
                return;
            }
            this.loadProject(e.target.options[e.target.selectedIndex].value);
        });

        document.body.addEventListener('mousemove', e => {
            if (this.moveNode) {
                this.moveNode.config.top = PERT.round(
                    Math.max(this.moveNode.originalTop + e.clientY - this.moveNode.top, 0),
                    -1
                );
                this.moveNode.config.left = PERT.round(
                    Math.max(this.moveNode.originalLeft + e.clientX - this.moveNode.left, 0),
                    -1
                );
                this.moveNode.node.style.top = `${this.moveNode.config.top}px`;
                this.moveNode.node.style.left = `${this.moveNode.config.left}px`;
                this.redrawEdges();
            }
        });

        document.documentElement.addEventListener('mouseout', e => {
            if (e.fromElement.tagName === 'HTML') {
                this.moveNode = null;
            }
        });
        document.body.addEventListener('mouseup', () => this.moveNode = null);

        document.body.addEventListener('drag', e => {
            if (e.target.redrawEdge) {
                e.target.redrawEdge(e.pageX, e.pageY);
            }
        });

        window.addEventListener('beforeunload', e => {
            const message = this.shouldStayOnPage(null, true);
            if (message) {
                e.preventDefault();
                return e.returnValue = message;
            }
        });
    }
}

window.onload = () => new PERT();
