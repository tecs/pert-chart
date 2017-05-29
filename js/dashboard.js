PERT.Dashboard = class Dashboard
{
    static redrawProjectsSelector()
    {
        const select = PERT.ui('menu-contents-projects');
        select.innerHTML = '<option disabled selected>Load a project</option>';
        for (const project of PERT.config.keys()) {
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
    static shouldStayOnPage(action, returnMessage)
    {
        let message = 'The current project has unsaved changes which will be lost if you continue.';
        if (typeof action === 'string') {
            message += ` ${action}`;
        }
        if (PERT.config.changed()) {
            return returnMessage ? message : !confirm(message);
        }
        return false;
    }

    /**
     * @param {String} name
     */
    static createProject(name)
    {
        PERT.config.reset();
        PERT.config.set(name, {});
        PERT.config.commit();
        Dashboard.redrawProjectsSelector();
    }

    /**
     * @param {String} name
     */
    static loadProject(name)
    {
        if (PERT.ui('menu-contents-projects').value !== name) {
            PERT.ui('menu-contents-projects').value = name;
        }

        PERT.config.reset();
        PERT.currentProject = new PERT.Project(name, PERT.config.ns(name));
        PERT.currentProject.drawElements(); // TODO: Find a better way to do this.
    }

    /**
     * @param {String} name
     */
    static deleteProject(name)
    {
        PERT.config.unset(name);
        PERT.config.commit();
        window.location.reload();
    }

    /**
     * @param {Boolean} [rename=false]
     * @returns {String|null}
     */
    static getNewProjectName(rename)
    {
        if (Dashboard.shouldStayOnPage()) {
            return null;
        }

        let promptText = '';
        let newName = rename ? PERT.currentProject.name : PERT.config.findFreeKey('Untitled Project ');
        for (;;) {
            promptText += `Please enter a ${rename ? 'new name for the' : 'name for the new'} project:`;
            newName = prompt(promptText, newName);
            if (newName === null || (rename && newName === PERT.currentProject.name)) {
                return null;
            } else if (newName === '') {
                promptText = 'The project name cannot be empty.\n';
            } else if (PERT.config.has(newName)) {
                promptText = 'A project with the selected name already exists.\n';
            } else {
                return newName;
            }
        }
    }

    static initializeUi()
    {
        Dashboard.redrawProjectsSelector();

        // Collapse menu arrow
        PERT.ui('menu-collapse').onclick = () => PERT.ui('menu').classList.toggle('menu-collapsed');
        PERT.ui('menu-contents-new').addEventListener('click', () => {
            const newName = Dashboard.getNewProjectName();

            if (newName !== null) {
                Dashboard.createProject(newName);
                Dashboard.loadProject(newName);
            }
        });

        PERT.ui('menu-contents-import').addEventListener('click', () => {
            const newName = Dashboard.getNewProjectName();

            if (newName !== null) {
                const file = document.createElement('input');
                file.type = 'file';
                file.accept = '.pert';
                file.addEventListener('change', () => {
                    const reader = new FileReader();

                    reader.addEventListener('load', () => {
                        PERT.config.reset();
                        PERT.config.set(newName, JSON.parse(reader.result));
                        PERT.config.commit();
                        Dashboard.redrawProjectsSelector();
                        Dashboard.loadProject(newName);
                    }, false);

                    if (file.files.length) {
                        reader.readAsText(file.files[0]);
                    }
                });
                file.click();
            }
        });

        PERT.ui('menu-contents-projects').addEventListener('change', e => {
            if (Dashboard.shouldStayOnPage()) {
                return;
            }
            Dashboard.loadProject(e.target.options[e.target.selectedIndex].value);
        });

        window.addEventListener('beforeunload', e => {
            const message = Dashboard.shouldStayOnPage(null, true);
            if (message) {
                e.preventDefault();
                return e.returnValue = message;
            }
        });

        // Load the last opened project
        const projects = [];
        for (const name of PERT.config.keys()) {
            const accessedAt = PERT.config.get(name).stats.accessedAt;
            projects.push({name, accessedAt});
        }
        projects.sort((a, b) => b.accessedAt - a.accessedAt);
        for (const project of projects) {
            Dashboard.loadProject(project.name);
            break;
        }
    }
};

window.onload = () => PERT.Dashboard.initializeUi();
