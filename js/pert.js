const PERT = { // eslint-disable-line no-unused-vars
    /**
     * @param {Number} number
     * @param {Number} [precision=0]
     * @returns {Number}
     */
    round(number, precision)
    {
        const multiplier = Math.pow(10, typeof precision === 'number' ? -precision : 0);
        return multiplier * Math.round(number / multiplier);
    }
};
