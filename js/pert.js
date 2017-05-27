const PERT = { // eslint-disable-line no-unused-vars
    config: new DataStore('pert'),
    currentProject: null,
    currentStats: null,

    /**
     * @param {Number} number
     * @param {Number} [precision=0]
     * @returns {Number}
     */
    round(number, precision)
    {
        const multiplier = Math.pow(10, typeof precision === 'number' ? -precision : 0);
        return multiplier * Math.round(number / multiplier);
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
