class Project
{
    /**
     * @param {String} name
     * @param {DataStore} config
     */
    constructor(name, config)
    {
        this.name = name;
        this.config = config;
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
        this.config.get('stats').accessedAt = Date.now();
        this.save();
    }

    get configData()
    {
        return this.config.getData();
    }

    save()
    {
        this.config.get('stats').modifiedAt = Date.now();
        this.config.commit();
    }
}
