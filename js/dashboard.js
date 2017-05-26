PERT.Dashboard = class Dashboard
{
    constructor()
    {
        this.config = new DataStore('pert');
        this.currentProject = null;
        this.currentStats = null;

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

    redrawProjectsSelector()
    {
        const select = PERT.ui('menu-contents-projects');
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
        if (PERT.ui('menu-contents-projects').value !== name) {
            PERT.ui('menu-contents-projects').value = name;
        }

        this.config.reset();
        this.currentProject = new PERT.Project(name, this.config.ns(name));
        this.currentStats = null;
        this.currentProject.redrawStats();
    }

    deleteProject()
    {
        this.config.unset(this.currentProject.name);
        this.config.commit();
        window.location.reload();
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
        let newName = rename ? this.currentProject.name : this.config.findFreeKey('Untitled Project ');
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
        PERT.ui('menu-collapse').onclick = () => PERT.ui('menu').classList.toggle('menu-collapsed');

        this.redrawProjectsSelector();

        PERT.ui('menu-contents-new').addEventListener('click', () => {
            const newName = this.getNewProjectName();

            if (newName !== null) {
                this.createProject(newName);
                this.loadProject(newName);
            }
        });

        PERT.ui('menu-contents-import').addEventListener('click', () => {
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

        PERT.ui('menu-contents-rename').addEventListener('click', () => {
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

        PERT.ui('menu-contents-delete').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete the current project? This action cannot be undone.')) {
                this.deleteProject(name);
            }
        });

        PERT.ui('menu-contents-save').addEventListener('click', () => this.currentProject.save());

        PERT.ui('menu-contents-projects').addEventListener('change', e => {
            if (this.shouldStayOnPage()) {
                return;
            }
            this.loadProject(e.target.options[e.target.selectedIndex].value);
        });

        document.body.addEventListener('mousemove', e => {
            if (this.currentProject && this.currentProject.moveNode) {
                this.currentProject.moveNode.config.top = PERT.round(
                    Math.max(
                        this.currentProject.moveNode.originalTop + e.clientY - this.currentProject.moveNode.top,
                        0
                    ),
                    -1
                );
                this.currentProject.moveNode.config.left = PERT.round(
                    Math.max(
                        this.currentProject.moveNode.originalLeft + e.clientX - this.currentProject.moveNode.left,
                        0
                    ),
                    -1
                );
                this.currentProject.moveNode.node.style.top = `${this.currentProject.moveNode.config.top}px`;
                this.currentProject.moveNode.node.style.left = `${this.currentProject.moveNode.config.left}px`;
                this.currentProject.redrawEdges();
            } else if (this.currentProject) {
                let nodeId = null;
                let element = e.srcElement;
                do {
                    if (element.classList.contains('node')) {
                        nodeId = element.id;
                        break;
                    }
                    element = element.parentElement;
                } while (element);

                if (nodeId !== this.currentStats) {
                    this.currentStats = nodeId;
                    this.currentProject.redrawStats(nodeId);
                }
            }
        });

        document.documentElement.addEventListener('mouseout', e => {
            if (e.fromElement.tagName === 'HTML') {
                this.currentProject.moveNode = null;
            }
        });
        document.body.addEventListener('mouseup', () => this.currentProject.moveNode = null);

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

window.onload = () => new PERT.Dashboard();
