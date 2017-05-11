class PERT
{
    constructor()
    {
        this.config = new DataStore('pert');
        this.uiCache = {};
        this.currentProject = null;
        this.currentProjectName = null;

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
     */
    findFreeKey(prefix, config)
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
        this.config.set(name, {
            resources: {},
            nodes: {},
            edges: {},
            stats: {
                accessedAt: null,
                modifiedAt: null,
                createdAt: Date.now()
            }
        });
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
        this.currentProject = this.config.ns(name);
        this.currentProjectName = name;

        const area = this.ui('area');
        area.innerHTML = '';

        this.ui('menu-contents').classList.add('menu-contents-project-loaded');

        const config = this.currentProject.getData();
        const projectMenu = this.ui('menu-contents-project');
        projectMenu.innerHTML = '<p>Resources</p>';

        for (const id in config.resources) {
            this.createResourceInputs(id);
        }
        this.createResourceInputs();

        for (const id in config.nodes) {
            this.drawNode(id);
        }

        for (const id in config.edges) {
            this.drawEdge(id);
        }

        config.stats.accessedAt = Date.now();
        this.currentProject.commit();
    }

    saveProject()
    {
        this.currentProject.get('stats').modifiedAt = Date.now();
        this.currentProject.commit();
    }

    deleteProject()
    {
        this.config.unset(this.currentProjectName);
        this.config.commit();
        window.location.reload();
    }

    /**
     * @param {String} [id]
     */
    createResourceInputs(id)
    {
        if (typeof id !== 'string') {
            id = this.findFreeKey('r', this.currentProject.ns('resources'))
        }
        const elements = {name: null, amount: null, concurrency: null};
        const config = this.currentProject.ns('resources').getData();
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
        const resources = this.currentProject.ns('resources');
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
        if (type === 'name') {
            this.updateNodes();
        }
    }
    /**
     * @param {String} name
     */
    addNode(name)
    {
        const nodes = this.currentProject.ns('nodes');
        const id = this.findFreeKey('n', nodes);

        let top = 200, left = 400;
        for (const node of nodes) {
            if (left < node.left + 320) {
                left = node.left + 320;
            }
        }
        nodes.set(id, {name, top, left});

        this.drawNode(id);
    }

    /**
     * @param {String} id
     */
    deleteNode(id)
    {
        const node = this.ui(id);
        node.parentNode.removeChild(node);
        this.currentProject.ns('nodes').unset(id);
    }

    /**
     * @param {String} id
     */
    drawNode(id)
    {
        const config = this.currentProject.ns('nodes').get(id);
        const node = document.createElement('div');
        node.id = id;
        node.className = 'node';
        node.style.top = `${config.top}px`;
        node.style.left = `${config.left}px`;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = config.name;
        node.appendChild(input);

        const drag = document.createElement('div');
        drag.className = 'node-drag';
        node.appendChild(drag);

        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'x';
        deleteButton.className = 'node-delete';
        node.appendChild(deleteButton);

        const edgeLink = document.createElement('div');
        edgeLink.className = 'node-edge';
        edgeLink.draggable = true;
        node.appendChild(edgeLink);

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
            if (e.target.className !== 'node' || e.dataTransfer.types.indexOf(id) !== -1) {
                return;
            }
            for (const edge of this.currentProject.ns('edges')) {
                if (edge.to === id) {
                    return;
                }
            }
            e.preventDefault();
        });
        node.addEventListener('drop', e => {
            this.currentProject.ns('edges').set(e.dataTransfer.getData('edgeid'), {
                from: e.dataTransfer.getData('id'),
                to: id
            });
            this.drawEdge(e.dataTransfer.getData('edgeid'));
        });

        edgeLink.addEventListener('dragstart', e => {
            const edgeId = this.findFreeKey('e', this.currentProject.ns('edges'));
            e.dataTransfer.dropEffect = 'move';
            e.dataTransfer.setData(id, id);
            e.dataTransfer.setData('id', id);
            e.dataTransfer.setData('edgeid', edgeId);
            e.target.redrawEdge = (x, y) => {
                const edge = this.createEdge(config.left + 300, config.top + 50, x, y, edgeId);
                if (!node.newedge) {
                    node.newedge = edge;
                    this.ui('area').appendChild(edge);
                }
            }
        });

        edgeLink.addEventListener('dragend', e => {
            e.dataTransfer.clearData();
            window.requestAnimationFrame(() => {
                if (!this.currentProject.ns('edges').has(node.newedge.id)) {
                    this.ui('area').removeChild(node.newedge);
                }
                delete node.newedge;
            });
        });
    }

    updateNodes()
    {
        for (const id of this.currentProject.ns('nodes').keys()) {
            this.updateNode(id);
        }
    }

    /**
     * @param {String} id
     */
    updateNode(id)
    {
        throw "not implemented";
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
        if (edge.className !== 'edge') {
            edge.className = 'edge';
            edge.id = id;
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
        const config = this.currentProject.ns('edges').get(id);
        const nodeConfig = this.currentProject.ns('nodes');
        const node1 = nodeConfig.get(config.from);
        const node2 = nodeConfig.get(config.to);
        const edge = this.createEdge(node1.left + 300, node1.top + 50, node2.left, node2.top + 50, id);
        if (!edge.parentNode) {
            this.ui('area').appendChild(edge);
        }
    }

    initializeUi()
    {
        this.ui('menu-collapse').onclick = () => this.ui('menu').classList.toggle('menu-collapsed');

        this.redrawProjectsSelector();

        this.ui('menu-contents-new').addEventListener('click', () => {
            if (this.shouldStayOnPage()) {
                return;
            }

            let promptText = '';
            let newName = this.findFreeKey('Untitled Project ', this.config);
            while (true) {
                promptText += 'Please enter a name for the new project:';
                newName = prompt(promptText, newName);
                if (newName === null) {
                    return;
                } else if (newName === '') {
                    promptText = 'The new project name cannot be empty.\n';
                } else if (this.config.has(newName)) {
                    promptText = 'A project with the selected name already exists.\n';
                } else {
                    break;
                }
            }

            this.createProject(newName);
            this.loadProject(newName);
        });

        this.ui('menu-contents-delete').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete the current project? This action cannot be undone.')) {
                this.deleteProject(name);
            }
        });

        this.ui('menu-contents-save').addEventListener('click', () => this.saveProject());
        this.ui('menu-contents-add-node').addEventListener('click', () => {
            let newName, promptText = '';
            while (true) {
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
                this.moveNode.config.top = Math.max(this.moveNode.originalTop + e.clientY - this.moveNode.top, 0);
                this.moveNode.config.left = Math.max(this.moveNode.originalLeft + e.clientX - this.moveNode.left, 0);
                this.moveNode.node.style.top = `${this.moveNode.config.top}px`;
                this.moveNode.node.style.left = `${this.moveNode.config.left}px`;
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
};

window.onload = () => new PERT();
