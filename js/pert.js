const PERT = { // eslint-disable-line no-unused-vars
    config: new DataStore('pert'),
    currentProject: null,
    currentStats: null,

    /**
     * @param {Number} number
     * @param {Number} [nearest=1]
     * @returns {Number}
     */
    round(number, nearest)
    {
        nearest = nearest || 1;
        return Math.round(number / nearest) * nearest;
    },

    /**
     * @param {...Object} objects
     * @returns {Object}
     */
    sumObjects(...objects)
    {
        const sum = {};
        for (const object of objects) {
            for (const key in object) {
                sum[key] = (sum[key] || 0) + object[key];
            }
        }
        return sum;
    },

    /**
     * @param {String} name
     * @returns {HTMLElement}
     */
    ui: (() => {
        const cache = {};
        return name => {
            if (!(name in cache)) {
                cache[name] = document.getElementById(name);
            }
            return cache[name];
        };
    })()
};
