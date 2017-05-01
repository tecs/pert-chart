class PERT
{
    constructor()
    {
        this.config = new DataStore('pert');
        this.uiCache = {};
        this.currentProject = null;
        this.currentProjectName = null;
    }
};
