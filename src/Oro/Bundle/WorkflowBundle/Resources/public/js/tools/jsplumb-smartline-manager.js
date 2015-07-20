define(function(require){
    'use strict';
    require('./path-finder');
    var JsPlumbOverlayManager = require('./jsplumb-overlay-manager');

    function matchEndpoints(paintInfo1, paintInfo2) {
        var keys = ['sx', 'sy', 'tx', 'ty'];
        return _.isEqual(_.pick(paintInfo1, keys), _.pick(paintInfo2, keys));
    }

    function JsPlumbSmartlineManager(jsPlumbInstance) {
        this.jsPlumbInstance = jsPlumbInstance;
        this.jsPlumbOverlayManager = new JsPlumbOverlayManager(this);
        this.cache = {};
        this.debouncedCalculateOverlays = _.debounce(
                _.bind(this.jsPlumbOverlayManager.calculate, this.jsPlumbOverlayManager),
            50);
    }

    window.getLastRequest = function () {
        return JSON.stringify(JsPlumbSmartlineManager.lastRequest);
    }

    JsPlumbSmartlineManager.prototype = {

        getNaivePathLength: function (fromRect, toRect) {
            return Math.abs(fromRect.bottom - toRect.top)
                + Math.max(0, fromRect.left - toRect.right, toRect.left - fromRect.right)
                + ((fromRect.bottom - toRect.top > 0) ? 2400 : 0);
        },

        calculate: function (connector, paintInfo) {
            var cache = {};
            var connections = [];
            var rects = {};
            var graph = new Graph();
            var endPoints = this.jsPlumbInstance.sourceEndpointDefinitions;
            for (var id in endPoints) {
                if (endPoints.hasOwnProperty(id)) {
                    var el = document.getElementById(id);
                    if (!el) {
                        this.cache = {};
                        return;
                    }
                    var rect = el.getBoundingClientRect(),
                        clientRect = new Rectangle(rect.left, rect.top, rect.width, rect.height);
                    rects[id] = clientRect;
                    clientRect.cid = id;
                    graph.rectangles.push(clientRect);
                }
            }

            graph.build();

            _.each(this.jsPlumbInstance.getConnections(), function (conn) {
                connections.push([conn.sourceId, conn.targetId, this.getNaivePathLength(rects[conn.sourceId], rects[conn.targetId]), conn]);
            }, this);

            connections.sort(function (a, b) {
                return a[2] - b[2];
            });

            JsPlumbSmartlineManager.lastRequest = {
                sources: graph.rectangles.map(function (item) {
                    return [item.cid, item.left, item.top, item.width, item.height];
                }),
                connections: connections.map(function (item) {return item.slice(0,2);})
            };

            _.each(connections, function (conn) {
                var finder = new Finder(graph);

                var fromRect = graph.getRectByCid(conn[0]);
                var fromNode = graph.getNodeAt(new Point2d((fromRect.left + fromRect.right) / 2, (fromRect.top + fromRect.bottom) / 2));
                var toRect = graph.getRectByCid(conn[1]);
                var toNode = graph.getNodeAt(new Point2d((toRect.left + toRect.right) / 2, (toRect.top + toRect.bottom) / 2));

                finder.addTo(new Path(toNode.connections[Direction2d.BOTTOM_TO_TOP.id], toNode, null));
                finder.addFrom(new Path(fromNode.connections[Direction2d.TOP_TO_BOTTOM.id], fromNode, null));

                var path = finder.find();
                if (!path) {
                    console.warn("Cannot find path");
                } else {
                    graph.updateWithPath(path);
                    cache[conn[3].connector.getId()] = {
                        connection: conn[3],
                        path: path,
                        paintInfo: conn[3].connector === connector ? paintInfo : undefined
                    };
                }
            });
            _.each(cache, function(item) {
                item.points = item.path.points.reverse();
                item.points[0].y += 20;
                item.points[item.points.length - 1].y -= 20;
            });
            _.extend(this.cache, cache);
            this.debouncedCalculateOverlays();
        },

        getConnectionPath: function (connector, paintInfo) {
            var connectorId = connector.getId();
            var cached = this.retrieveCacheItem(connectorId, paintInfo);

            if (cached === false) {
                this.calculate(connector, paintInfo);
                cached = this.retrieveCacheItem(connectorId, paintInfo);
            }

            if (cached !== false) {
                return _.clone(cached.points);
            }

            console.warn("Path not found");
            return [];
        },

        retrieveCacheItem: function (connectorId, paintInfo) {
            var cached = connectorId in this.cache ? this.cache[connectorId] : undefined;
            if (cached) {
                if (cached.points.length && (_.isUndefined(cached.paintInfo) || matchEndpoints(cached.paintInfo, paintInfo))) {
                    cached.paintInfo = paintInfo;
                    return cached;
                } else {
                    delete this.cache[connectorId];
                }
            }
            return false;
        }
    };

    return JsPlumbSmartlineManager;
});
