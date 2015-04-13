'use strict';

define(['module', 'knockout', 'ko-grid'], function (module, ko, koGrid) {
    var extensionId = module.id.indexOf('/') < 0 ? module.id : module.id.substring(0, module.id.indexOf('/'));

    var SELECTION_CLASS = 'ko-grid-selection-element';

    koGrid.defineExtension(extensionId, {
        Constructor: function SelectionExtension(bindingValue, config, grid) {
            var allowMultiSelection = !!(bindingValue['allowMultiSelection'] || config['allowMultiSelection']);
            var evaluateRowClicks = !!(bindingValue['evaluateRowClicks'] || config['evaluateRowClicks']);
            var selectedEntriesIds = bindingValue['selectedEntriesIds'] || ko.observableArray([]);
            var selectedEntryId = bindingValue['selectedEntryId'] || ko.observable(null);
            var allSelected = false;

            var column = grid.columns.add({
                key: 'selection',
                label: '',
                width: grid.layout.determineCellDimensions(createSelectionElement(allowMultiSelection)).width + 'px'
            });
            var header = grid.headers.forColumn(column);

            var isSelected = {};

            var primaryKey = grid.primaryKey;

            column.overrideValueBinding(b => ({
                init: function (element) {
                    element.appendChild(createSelectionElement(allowMultiSelection));
                },
                update: function (element, cell, row) {
                    selectedEntriesIds(); // track dependency
                    element.firstChild.checked = !!isSelected[grid.data.valueSelector(row[primaryKey])];
                }
            }));

            var headerElementSubscription = header.element.subscribe(function (newElement) {
                if (!allowMultiSelection || !newElement) return;

                var checkbox = createSelectionElement(true);
                newElement.appendChild(checkbox);

                newElement.addEventListener('click', e => {
                    if (e.target === newElement) {
                        e.preventDefault();
                        toggleAllSelection();
                    }
                });
            });

            grid.headers.onColumnHeaderClick('.' + SELECTION_CLASS, function (event) {
                event.preventApplicationButAllowBrowserDefault();
                toggleAllSelection();
            });

            function toggleAllSelection() {
                if (allSelected) {
                    isSelected = {};
                    selectedEntriesIds([]);
                } else {
                    grid.data.source
                        .streamValues(q => q.filteredBy(grid.data.predicate))
                        .then(s => s
                            .reduce((a, v) => {
                                var id = grid.data.valueSelector(v[primaryKey]);
                                a.ids.push(id);
                                a.predicate[id] = true;
                                return a;
                            }, {ids: [], predicate: {}}))
                        .then(r => {
                            isSelected = r.predicate;
                            selectedEntriesIds(r.ids);
                        });
                }
            }

            function toggleEntrySelection(event, cell, row) {
                var entryId = grid.data.observableValueSelector(ko.unwrap(row[primaryKey]));

                if (!allowMultiSelection) {
                    isSelected = {};
                    selectedEntriesIds().length = 0;
                }

                if (isSelected[entryId]) {
                    delete isSelected[entryId];
                    selectedEntriesIds.remove(entryId);
                } else {
                    isSelected[entryId] = true;
                    selectedEntriesIds.push(entryId);
                }
            }

            if (evaluateRowClicks)
                grid.data.onCellClick(toggleEntrySelection);
            else
                grid.data.onCellClick('.' + SELECTION_CLASS, toggleEntrySelection);

            grid.data.rows.installClassifier(function (row) {
                selectedEntriesIds(); // track dependency
                return isSelected[grid.data.observableValueSelector(ko.unwrap(row[primaryKey]))] ? ['selected'] : [];
            });

            var stateComputer = ko.computed(() => {
                var selectedEntryCount = selectedEntriesIds().length;
                var filteredSize = grid.data.view.filteredSize();

                selectedEntryId(selectedEntryCount ? selectedEntriesIds()[selectedEntryCount - 1] : null);
                // TODO This is /broken/! Two sets being of equal size does not imply they are equal.
                allSelected = !!selectedEntryCount && selectedEntryCount === filteredSize;

                var headerElement = header.element(),
                    checkbox = headerElement && headerElement.querySelector('.' + SELECTION_CLASS);
                if (checkbox) {
                    checkbox.checked = allSelected;
                    checkbox.indeterminate = selectedEntryCount > filteredSize;
                }
            });

            this.dispose = function () {
                headerElementSubscription.dispose();
                stateComputer.dispose();
            };
        }
    });

    function createSelectionElement(allowMultiSelection) {
        var element = window.document.createElement('input');
        element.className = SELECTION_CLASS;
        element.type = allowMultiSelection ? 'checkbox' : 'radio';
        element.tabIndex = -1;
        return element;
    }

    return koGrid.declareExtensionAlias('selection', extensionId);
});
