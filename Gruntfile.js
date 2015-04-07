'use strict';

module.exports = function (grunt) {
    require('grunt-commons')(grunt, {
        name: 'ko-grid-selection',
        main: 'selection',
        internalMain: 'selection',

        shims: {
            knockout: 'window.ko',
            'ko-grid': 'window.ko.bindingHandlers[\'grid\']'
        }
    }).initialize({
        less: true
    });
};
