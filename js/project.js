PERT.Project = class Project
{
    /**
     * @param {String} name
     * @param {DataStore} config
     */
    constructor(name, config)
    {
        this.name = name;
        this.config = config;
        if (!this.config.keys().length) {
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

        PERT.ui('area').innerHTML = '<div class="project-area"></div>';
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

        this.configData.stats.accessedAt = Date.now();
        this.save();

        project.querySelector('.project-save').addEventListener('click', () => this.save());
        project.querySelector('.project-export').addEventListener('click', () => this.export());
        project.querySelector('.project-rename').addEventListener('click', () => this.rename());
        project.querySelector('.project-delete').addEventListener('click', () => this.delete());
        project.querySelector('.project-add-node').addEventListener('click', () => this.addNode());

        const projectArea = PERT.ui('area').querySelector('.project-area');

        projectArea.addEventListener('mousemove', e => {
            if (this.moveNode) {
                this.moveNode.drag(e.clientX + projectArea.scrollLeft, e.clientY + projectArea.scrollTop);
            } else {
                let nodeId = null;
                let element = e.srcElement;
                do {
                    if (element.classList.contains('node')) {
                        nodeId = element.id;
                        break;
                    }
                    element = element.parentElement;
                } while (element);

                if (nodeId !== PERT.currentStats) {
                    PERT.currentStats = nodeId;
                    this.redrawStats(nodeId);
                }
            }
        });

        projectArea.addEventListener('mouseout', e => {
            if (e.fromElement.tagName === 'HTML') {
                this.moveNode = null;
            }
        });

        projectArea.addEventListener('mouseup', () => this.moveNode = null);

        projectArea.addEventListener('drag', e => {
            if (e.target.redrawEdge) {
                e.target.redrawEdge(e.pageX, e.pageY);
            }
        });

        this.nodes = {};
        PERT.currentStats = null;
    }

    /**
     * @returns {Object}
     */
    get configData()
    {
        return this.config.getData();
    }

    save()
    {
        this.config.get('stats').modifiedAt = Date.now();
        this.config.commit();
    }

    rename()
    {
        const newName = PERT.Dashboard.getNewProjectName(true);

        if (newName !== null) {
            PERT.config.reset();
            PERT.config.set(newName, this.configData);
            PERT.config.unset(this.name);
            PERT.config.commit();
            PERT.Dashboard.redrawProjectsSelector();
            PERT.Dashboard.loadProject(newName);
        }
    }

    delete()
    {
        if (confirm('Are you sure you want to delete the current project? This action cannot be undone.')) {
            PERT.Dashboard.deleteProject(this.name);
        }
    }

    export()
    {
        const json = JSON.stringify(this.configData);
        const blob = new Blob([json], {type: 'application/json'});
        const reader = new FileReader();
        reader.addEventListener('load', e => {
            const link = document.createElement('a');
            link.download = `${this.name}.pert`;
            link.href = e.target.result;
            link.click();
        });
        reader.readAsDataURL(blob);
    }

    addNode()
    {
        let name, promptText = '';
        for (;;) {
            promptText += 'Please enter a name for the new milestone:';
            name = prompt(promptText, name);
            if (name === null) {
                return;
            } else if (name === '') {
                promptText = 'The new milestone name cannot be empty.\n';
            } else {
                break;
            }
        }

        const nodes = this.config.ns('nodes');
        const id = nodes.findFreeKey('n');
        nodes.set(id, {});

        this.nodes[id] = new PERT.Node(id, nodes.ns(id), name);

        this.recalculateDateConstraints();
    }

    drawElements()
    {
        const nodes = this.config.ns('nodes');
        const edges = this.config.get('edges');
        for (const id of nodes.keys()) {
            this.nodes[id] = new PERT.Node(id, nodes.ns(id));
        }
        for (const id in edges) {
            this.nodes[edges[id].from].connect(id, this.nodes[edges[id].to]);
        }
        this.redrawStats();
        this.recalculateDateConstraints();
    }

    /**
     * @param {String} id
     */
    deleteNode(id)
    {
        delete this.nodes[id];
        this.config.ns('nodes').unset(id);
        this.recalculateDateConstraints();
        this.recalculateResourceConstraints();
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

        for (const id in this.nodes) {
            this.nodes[id].update();
        }
    }

    recalculateDateConstraints()
    {
        const project = PERT.ui('menu-contents-project').querySelectorAll('.project-dates input');
        Object.assign(project[0], project[1], {min: '', max: ''});

        const left = [], right = [];
        for (const nodeId in this.nodes) {
            const node = this.nodes[nodeId];
            Object.assign(node.dateInputs[0], node.dateInputs[1], {min: '', max: ''});
            if (!node.getNeighbours(true).length) {
                left.push(node);
            }
            if (!node.getNeighbours().length) {
                right.push(node);
            }
        }
        left.forEach(node => node.updateDateConstraints(false, project[0].value));
        right.forEach(node => node.updateDateConstraints(true, project[1].value));

        left.forEach(node => {
            const value = node.dateInputs[0].value || node.dateInputs[1].value || node.dateInputs[1].max;
            if (!project[0].max || (value && project[0].max > value)) {
                project[0].max = value;
            }
        });
        right.forEach(node => {
            const value = node.dateInputs[1].value || node.dateInputs[0].value || node.dateInputs[0].min;
            if (!project[1].min || (value && project[1].min < value)) {
                project[1].min = value;
            }
        });
        this.recalculateResourceConstraints();
    }

    recalculateResourceConstraints()
    {
        const nodes = this.config.get('nodes');
        const nodesOrdered = this
            .config
            .ns('nodes')
            .keys()
            .sort((a, b) => (nodes[a].start || nodes[a].end) > (nodes[b].start || nodes[b].end) ? 1 : -1);
        const resources = this.config.get('resources');
        const resourcesLeft = {}, concurrencies = {};
        for (const resourceId in resources) {
            resourcesLeft[resourceId] = resources[resourceId].amount;
            concurrencies[resourceId] = resources[resourceId].concurrency;
        }

        const events = [];
        for (const nodeId of nodesOrdered) {
            const node = nodes[nodeId];
            if (!(nodeId in this.nodes)) {
                continue;
            }
            const nodeElement = this.nodes[nodeId].node;
            const resourceCells = nodeElement.querySelectorAll('.node-resources td');

            nodeElement.classList.remove('red');

            for (const resourceId in node.resources) {
                if (!(resourceId in resources)) {
                    continue;
                }
                resourcesLeft[resourceId] -= node.resources[resourceId];
                const index = Object.keys(node.resources).indexOf(resourceId) * 2;
                if (node.resources[resourceId] > 0 && resourcesLeft[resourceId] < 0) {
                    resourceCells[index].classList.add('red');
                    resourceCells[index+1].classList.add('red');
                    nodeElement.classList.add('red');
                } else {
                    resourceCells[index].classList.remove('red');
                    resourceCells[index+1].classList.remove('red');
                }

                if (resources[resourceId].concurrency && node.resources[resourceId] > 0) {
                    const dates = this.nodes[nodeId].dateInputs;
                    events.push({nodeId, resourceId, start: true, time: dates[0].value || dates[1].min});
                    events.push({nodeId, resourceId, start: false, time: dates[1].value || dates[0].max || 'z'});
                }
            }
        }
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
            return this.nodes[a.nodeId].level() > this.nodes[b.nodeId].level() ? 1 : -1;
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
        let resourcesSpent = {};

        for (const nodeId in this.nodes) {
            if (this.nodes[nodeId].configData.from > date) {
                continue;
            }
            resourcesSpent = PERT.sumObjects(resourcesSpent, this.nodes[nodeId].cost());
        }
        return resourcesSpent;
    }

    /**
     * @param {String} [nodeId]
     */
    redrawStats(nodeId)
    {
        const stats = nodeId ? this.nodes[nodeId].cost(true) : this.costUntil(this.config.get('end'));
        const resources = this.config.get('resources');
        const statArea = PERT.ui('menu-contents-project').querySelector('.project-stats');

        statArea.innerHTML = '';
        for (const key in stats) {
            const row = document.createElement('tr');
            [resources[key].name, stats[key]]
                .map(value => {
                    const td = document.createElement('td');
                    td.innerText = value;
                    return td;
                })
                .forEach(td => row.appendChild(td));
            statArea.appendChild(row);
        }
    }
};
