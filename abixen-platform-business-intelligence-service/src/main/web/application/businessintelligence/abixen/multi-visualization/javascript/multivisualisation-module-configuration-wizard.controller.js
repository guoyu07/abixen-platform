/**
 * Copyright (c) 2010-present Abixen Systems. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation; either version 2.1 of the License, or (at your option)
 * any later version.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 */

(function () {

    'use strict';

    angular
        .module('platformChartModule')
        .controller('ChartModuleConfigurationWizardController', ChartModuleConfigurationWizardController);

    ChartModuleConfigurationWizardController.$inject = [
        '$scope',
        '$log',
        'ApplicationDatabaseDataSource',
        'ChartModuleConfiguration',
        'CharDataPreview',
        'multivisualisationWizardStep'
    ];

    function ChartModuleConfigurationWizardController($scope, $log, ApplicationDatabaseDataSource, ChartModuleConfiguration, CharDataPreview, multivisualisationWizardStep) {
        $log.log('ChartModuleConfigurationWizardController');

        var configWizard = this;
        var seriesNumber = 1; //todo remove in the future

        configWizard.stepCurrent = 0;
        configWizard.stepMax = 3;

        //TODO - check if needed
        $scope.chartConfiguration = configWizard.chartConfiguration = {
            axisXName: '',
            axisYName: '',
            id: null,
            moduleId: null
        };

        configWizard.chartTypes = multivisualisationWizardStep.getChartTypes();
        configWizard.dataSources = null;

        configWizard.chart = {
            name: null,
            hasTable: false,
            axisX: null,
            axisY: null,
            series: null,
            seriesSelected: null
        };

        configWizard.table = {
            columns: [],
            columnSelected: null
        };

        configWizard.setDataSourceSelected = setDataSourceSelected;
        configWizard.setChartTypeSelected = setChartTypeSelected;
        configWizard.initDataSetSeries = initDataSetSeries;
        configWizard.addDataSetSeries = addDataSetSeries;
        configWizard.removeDataSetSeries = removeDataSetSeries;
        configWizard.setDataSetSeriesSelected = setDataSetSeriesSelected;
        configWizard.canNext = canNext;
        configWizard.next = next;
        configWizard.prev = prev;
        configWizard.reloadPreviewData = reloadPreviewData;
        configWizard.isChart = $scope.isChart = chartTypeWizardStepIsChart;
        configWizard.setColumnSelected = setColumnSelected;


        getChartConfiguration($scope.moduleId);
        changeWizardView();


        function chartTypeWizardStepValidate() {
            return configWizard.chartConfiguration.chartType !== null;
        }

        function chartTypeWizardStepIsChart() {
            return !(configWizard.chartConfiguration.chartType === 'TABLE')
        }

        function setChartTypeSelected(chartType) {
            configWizard.chartConfiguration.chartType = chartType.type;
        }

        function saveConfiguration(configuration) {
            if (configuration === undefined) configuration = configWizard.chartConfiguration;
            configuration = prepareFilterForDomain(configuration);
            if (configWizard.chartConfiguration.id) {
                ChartModuleConfiguration.update({id: configuration.id}, configuration, function () {
                    $log.log('ChartModuleConfiguration has been updated: ', configuration);
                    $scope.$emit('VIEW_MODE');
                });
            } else {
                ChartModuleConfiguration.save(configuration, function () {
                    $log.log('ChartModuleConfiguration has been saved: ', configuration);
                    $scope.$emit('VIEW_MODE');
                });
            }
        }

        function prepareFilterForDomain(configuration) {
            $log.debug("configuration", configuration);
            configuration.filter = parseObjToJsonCriteriaAsString(configuration.dataSetChart.domainXSeriesColumn);
            return configuration
        }

        function parseObjToJsonCriteriaAsString(domainSeries) {
            return convertToString(buildJsonFromObj(domainSeries))
        }

        function buildJsonFromObj(domainSeries) {
            if (domainSeries.filterObj === null || domainSeries.filterObj === undefined) {
                domainSeries.filterObj = {};
            }
            return {
                group: {
                    operator: 'AND',
                    rules: [
                        {
                            condition: domainSeries.filterObj.operator,
                            field: domainSeries.dataSourceColumn.name,
                            data: domainSeries.filterObj.value
                        }
                    ]
                }
            }
        }

        function buildObjFromJson(domainSeries, json) {
            var jsonObj = JSON.parse(json);

            if (jsonObj.group !== undefined) {
                domainSeries.filterObj = {};
                domainSeries.filterObj.operator = jsonObj.group.rules[0].condition;
                domainSeries.filterObj.value = jsonObj.group.rules[0].data;
            }
        }

        function convertToString(jsonObj) {
            return JSON.stringify(jsonObj);
        }

        function setColumnSelected(idx) {
            $log.log('moduleConfigurationWizardStep setSelected ', idx);

            configWizard.table.columnSelected = configWizard.table.columns[idx - 1];
            configWizard.table.columns[idx - 1].isActive = !configWizard.table.columns[idx - 1].isActive;
            if (configWizard.table.columns[idx - 1].isActive === true) {
                getColumnData(idx - 1);
            } else {
                buildTableConfiguration();
            }
        }

        function refreshColumn() {
            $log.debug('configWizard.chartConfiguration.dataSource', configWizard.chartConfiguration.dataSource);
            configWizard.table.columns = [];
            function compare(a, b) {
                if (a.id < b.id)
                    return -1;
                if (a.id > b.id)
                    return 1;
                return 0;
            }

            configWizard.chartConfiguration.dataSource.columns.sort(compare).forEach(function (column) {
                var isActive = false;
                if (configWizard.chartConfiguration.dataSetChart.domainXSeriesColumn.dataSourceColumn !== null) {
                    isActive = configWizard.chartConfiguration.dataSetChart.domainXSeriesColumn.dataSourceColumn.name === column.name;
                }
                if (isActive === false && configWizard.chartConfiguration.dataSetChart.dataSetSeries !== null) {
                    configWizard.chartConfiguration.dataSetChart.dataSetSeries.forEach(function (series) {
                        if (isActive === false && series.valueSeriesColumn.name === column.name) {
                            isActive = true;
                        }
                    })
                }

                configWizard.table.columns.push({
                    idx: column.id,
                    name: column.name,
                    isValid: true,
                    isActive: isActive,
                    dataSourceColumn: column
                });
            })
        }

        function moduleConfigurationWizardStepSelected() {
            $log.log('moduleConfigurationWizardStep selected');
            if (configWizard.stepCurrent === 2 && !chartTypeWizardStepIsChart()) {
                refreshColumn();
            }
        }

        function getColumnData(idx) {
            configWizard.table.columnPreviewData = [];
            if (configWizard.table.columnSelected.name != undefined && configWizard.table.columnSelected.name !== '') {
                CharDataPreview.query({seriesName: configWizard.table.columnSelected.name}, buildTableConfiguration(), function (data) {
                    $log.log('CharDataPreview.query: ', data);
                    data.forEach(function (el) {
                        configWizard.table.columnPreviewData.push({
                            value: el[configWizard.table.columnSelected.name].value
                        });
                    })

                });
            }
        }

        function getSeriesData() {
            configWizard.chart.seriesPreviewData = [];
            if (configWizard.dataSetSeriesSelected.valueSeriesColumn.dataSourceColumn !== null && configWizard.dataSetSeriesSelected.valueSeriesColumn.dataSourceColumn.name !== undefined && configWizard.dataSetSeriesSelected.valueSeriesColumn.dataSourceColumn.name !== '') {
                configWizard.chartConfiguration = prepareFilterForDomain(configWizard.chartConfiguration);
                CharDataPreview.query({seriesName: configWizard.dataSetSeriesSelected.name}, configWizard.chartConfiguration, function (data) {
                    $log.log('CharDataPreview.query: ', data);
                    data.forEach(function (el) {
                        configWizard.chart.seriesPreviewData.push({
                            x: el[configWizard.chartConfiguration.dataSetChart.domainXSeriesColumn.dataSourceColumn.name].value,
                            y: el[configWizard.dataSetSeriesSelected.valueSeriesColumn.dataSourceColumn.name].value
                        });
                    })

                }, function (error) {

                });
            }
        }

        function getDataSources() {
            $scope.$emit(platformParameters.events.START_REQUEST);
            var queryParameters = {
                page: 0,
                size: 10000,
                sort: 'id,asc'
            };

            ApplicationDatabaseDataSource.query(queryParameters)
                .$promise
                .then(onQueryResult, onQueryError);

            function onQueryResult(data) {
                configWizard.dataSources = data.content;
                $scope.$emit(platformParameters.events.STOP_REQUEST);
            }

            function onQueryError() {
                $scope.$emit(platformParameters.events.STOP_REQUEST);
            }
        }

        function setDataSourceSelected(dataSource) {
            configWizard.chartConfiguration.dataSource = dataSource;
        }

        function dataSourceWizardStepStepSelected() {
            if (configWizard.dataSources == null) {
                getDataSources();
            }
        }

        function dataSourceWizardStepValidate() {
            return configWizard.chartConfiguration.dataSource !== null;
        }

        function buildTableConfiguration() {
            var tableConfiguration = {
                axisXName: '',
                axisYName: '',
                chartType: 'TABLE',
                dataSource: configWizard.chartConfiguration.dataSource,
                moduleId: configWizard.chartConfiguration.moduleId,
                id: configWizard.chartConfiguration.id,
                dataSetChart: {
                    dataSetSeries: [],
                    domainXSeriesColumn: null,
                    domainZSeriesColumn: null
                }
            };

            var i = 0;
            configWizard.table.columns.forEach(function (column) {
                $log.debug('column: ', column);
                if (column.isActive === true) {
                    if (i === 0) {
                        tableConfiguration.dataSetChart.domainXSeriesColumn = {
                            id: null,
                            name: '',
                            type: 'X',
                            dataSourceColumn: column.dataSourceColumn
                        };
                        i++
                    } else {
                        tableConfiguration.dataSetChart.dataSetSeries.push({
                            id: null,
                            name: column.dataSourceColumn.name,
                            isValid: true,
                            valueSeriesColumn: {
                                id: null,
                                name: column.dataSourceColumn.name,
                                type: 'Y',
                                dataSourceColumn: column.dataSourceColumn
                            }
                        });
                        i++;
                    }
                }
            });
            return tableConfiguration
        }

        function prev() {
            if (configWizard.stepCurrent > 0) {
                configWizard.stepCurrent--;
            }
        }

        function changeWizardView() {
            switch (configWizard.stepCurrent) {
                //TODO - is it OK?
                case 0:

                case 1:
                    dataSourceWizardStepStepSelected();
                    break;
                case 2:
                    moduleConfigurationWizardStepSelected();
                    break;
            }
        }

        function getChartConfiguration(moduleId) {
            if (moduleId === null) {
                return;
            }
            ChartModuleConfiguration.get({id: moduleId}, function (data) {
                $scope.chartConfiguration = configWizard.chartConfiguration = data;
                if (configWizard.chartConfiguration.id == null) {
                    configWizard.chartConfiguration = {
                        moduleId: $scope.moduleId,
                        axisXName: '', //TODO maybe null, not '' ?
                        axisYName: '',
                        dataSetChart: {
                            dataSetSeries: [],
                            domainXSeriesColumn: {
                                id: null,
                                name: '',
                                type: 'X',
                                dataSourceColumn: null
                            }
                        }
                    }
                } else {
                    buildObjFromJson(configWizard.chartConfiguration.dataSetChart.domainXSeriesColumn, configWizard.chartConfiguration.filter);
                }
            });
        }

        function initDataSetSeries() {
            if (configWizard.chartConfiguration.dataSetChart.dataSetSeries.length === 0) {
                addDataSetSeries();
            } else {
                if (configWizard.dataSetSeriesSelected === undefined || configWizard.dataSetSeriesSelected === null) {
                    configWizard.setDataSetSeriesSelected(configWizard.chartConfiguration.dataSetChart.dataSetSeries[0]);
                }
            }
        }

        function addDataSetSeries() {
            $log.log('moduleConfigurationWizardStep series', configWizard.chartConfiguration.dataSetChart.dataSetSeries);

            if (configWizard.chartConfiguration.dataSetChart.dataSetSeries === undefined) {
                configWizard.chartConfiguration.dataSetChart.dataSetSeries = [];
            }

            if (configWizard.chartConfiguration.dataSetChart.dataSetSeries.length == 0) {
                seriesNumber = 1;
            }

            configWizard.chartConfiguration.dataSetChart.dataSetSeries.push({
                id: null,
                name: ('Series ' + seriesNumber),
                isValid: true,
                valueSeriesColumn: {
                    id: null,
                    name: '',
                    type: 'Y',
                    dataSourceColumn: null
                }

            });
            seriesNumber++;

            if (configWizard.dataSetSeriesSelected == null) {
                configWizard.setDataSetSeriesSelected(configWizard.chartConfiguration.dataSetChart.dataSetSeries[0]);
            }
        }

        function removeDataSetSeries(dataSetSeries) {
            $log.log('moduleConfigurationWizardStep removeSeries ', dataSetSeries);

            var index = configWizard.chartConfiguration.dataSetChart.dataSetSeries.indexOf(dataSetSeries);

            if (index + 1 < configWizard.chartConfiguration.dataSetChart.dataSetSeries.length) {
                var nextDataSetSeries = configWizard.chartConfiguration.dataSetChart.dataSetSeries[index + 1];
                configWizard.setDataSetSeriesSelected(nextDataSetSeries);
            } else if (index > 0) {
                var prevDataSetSeries = configWizard.chartConfiguration.dataSetChart.dataSetSeries[index - 1];
                configWizard.setDataSetSeriesSelected(prevDataSetSeries);
            } else {
                configWizard.setDataSetSeriesSelected(null);
            }

            configWizard.chartConfiguration.dataSetChart.dataSetSeries.splice(index, 1);

            //TODO - select previous

            /*for (var i = 0; i < configWizard.chart.series.length; i++) {
             if (configWizard.chart.series[i].idx == idx) {
             configWizard.chart.series[i].isValid = false;
             }
             }*/

        }

        function setDataSetSeriesSelected(dataSetSeries) {
            $log.log('moduleConfigurationWizardStep setSelected ', dataSetSeries);

            configWizard.dataSetSeriesSelected = dataSetSeries; //configWizard.chart.series[idx - 1];

            getSeriesData();
        }

        function canNext() {
            var validate = true;
            if (configWizard.stepCurrent == 0) {
                validate = chartTypeWizardStepValidate();
                return validate;
            }
            if (configWizard.stepCurrent == 1) {
                validate = dataSourceWizardStepValidate();
                return validate;
            }
            return validate
        }

        function next() {
            if (configWizard.stepCurrent < configWizard.stepMax) {
                configWizard.stepCurrent++;
                changeWizardView();
            } else {
                if (chartTypeWizardStepIsChart()) {
                    saveConfiguration();
                } else {
                    saveConfiguration(buildTableConfiguration())
                }
            }
            $log.log('next step:', configWizard.stepCurrent);
        }

        function reloadPreviewData() {
            getSeriesData();
        }

    }
})();