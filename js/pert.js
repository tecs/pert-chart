const PERT = { // eslint-disable-line no-unused-vars
    config: new DataStore('pert'),
    currentProject: null,
    currentStats: null,

    /**
     * Rounds the supplied number to the nearest provided decimal.
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
     * Sums the matching properties of the supplied objects.
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
     * Creates and returns a normalized date object.
     * @param {String} [from='']
     * @returns {Date}
     */
    getDate(from)
    {
        const date = from ? new Date(from) : new Date();
        date.setUTCHours(0, 0, 0, 0);
        return date;
    },

    /**
     * A caching wrapper around `document.getElementById()`.
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
