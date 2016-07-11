(function(exports, global, define, module) {var vtConfig = {
	pingQueueUrl: 'http://local-checkin.purechat.com/api/checkin',
	dashboardRootUrl: 'http://local-app.purechat.com',
	apiRootUrl: 'http://local-api.purechat.com',
	pidCookieName: 'localvtftwPID',
	pingInterval: 5000,
	sessionTimeout: 1000 * 60 * 20 // 20 minutes
};
var tinyAjax = {
	jsonToQuery: function(json) {
		json = json || {};
		var query = '?';
		for (var prop in json) {
			query += prop + '=' + encodeURIComponent((json[prop] || '').toString()) + '&';
		}
		return query;
	},
	_parseResponseAsJSON: function(responseText) {
		responseText = (responseText || '{}').trim();
		try {
			return JSON.parse(responseText);
		} catch (ex) {
			console.log('Unable to parse JSON from tiny Ajax request.');
			console.log(ex);
		}
	},
	_mapOptionsToRequest: function(req, options) {
		req.withCredentials = options.withCredentials || false;
	},
	_createRequest: function(method, url, data, options) {
		var callback = tinyAjax._getSuccessCallback(options);
		var errorCallback = tinyAjax._getErrorCallback(options);
		var alwaysCallback = tinyAjax._getAlwaysCallback(options);
		if (window.XMLHttpRequest) {
			var ajax = new XMLHttpRequest();
			tinyAjax._mapOptionsToRequest(ajax, options);
			ajax.onreadystatechange = function() {
				if (ajax.status == 200 && ajax.readyState == 4) {
					// Request complete
					var responseContentType = (ajax.getResponseHeader('Content-Type') || '').toLowerCase();
					if (responseContentType.search('application/json') > -1) {
						// Parse the JSON ?

					}
					var parsedResponse = tinyAjax._parseResponseAsJSON(ajax.responseText);
					callback(parsedResponse);
					alwaysCallback(parsedResponse);
				}
			};
			ajax.onerror = function() {
				errorCallback();
				alwaysCallback();
			};
			for (var prop in data) {
				if (typeof data[prop] === 'object') {
					data[prop] = JSON.stringify(data[prop]);
				}
			}
			switch (method) {
			case 'POST':
			case 'PUT':
				ajax.open(method, url, true);
				//ajax.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				ajax.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
				ajax.send(JSON.stringify(data));
				//ajax.send(tinyAjax.jsonToQuery(data).replace('?', ''));
				break;
			default:
				url += tinyAjax.jsonToQuery(data);
				ajax.open(method, url, true);
				ajax.send();
				break;
			}
		} else {
			console.log('Browser does not support XMLHttpRequests');
		}
	},
	_getSuccessCallback: function(options) {
		return options.callback || function() {};
	},
	_getErrorCallback: function(options) {
		return options.error || function() {};
	},
	_getAlwaysCallback: function(options) {
		return options.always || function() {};
	},
	get: function(url, data, options) {
		tinyAjax._createRequest('GET', url, data, options);
	},
	post: function(url, data, options) {
		tinyAjax._createRequest('POST', url, data, options);
	},
	delete: function(url, options) {
		tinyAjax._createRequest('DELETE', url, data, options);
	},
	put: function(url, data, options) {
		tinyAjax._createRequest('PUT', url, data, options);
	}
};
function tinyEvents() {

}

function trackerEvent(evtName, callbackFnc) {
	this.eventName = evtName;
	this.callbackFnc = callbackFnc || function () { };

	this.applyCallback = function (args) {
		this.callbackFnc.apply(window.vtftw, [args]);
	};
}

function tracker(cfg, tajax, sid, eventsOnLoad) {
	// Private vars
	var ctx = this;
	ctx.firstLoad = true;
	var config = cfg;
	var tinyAjax = tajax;
	var sid = sid;
	var pid;
	var url = document.location.href;
	var ref = document.referrer || 'Direct';
	var evtOnLoad = eventsOnLoad;
	var userActive = true;
	var userAlwaysActive = false;
	var inactivityTimeout = null;
	var additionalInfo = {};
	var pingCount = 1;

	// Public instance vars
	this.events = [];
	this.initialized = false;

	function resetTimer() {
		userActive = true;
		inactivityTimeout = clearTimeout(inactivityTimeout);
		if (!userAlwaysActive) {
			inactivityTimeout = setTimeout(userInactive, 1000 * 60 * 5);
		}
	}

	function userInactive() {
		userActive = false;
		ctx.userInactive();
	}

	function inactivityTime() {
		document.addEventListener("keypress", resetTimer);
		document.addEventListener("mousemove", resetTimer);
		resetTimer();
	}

	function generatePid() {
		// Get first pid
		pid = (new Date()).getTime();
	}

	function cleanNulls(val) {
		//there was a bug out there for awhile and some of the ids where set to null
		//so lets clean them up.
		return val == 'null' ? undefined : val == null ? undefined : val;
	}

	function getLastCheckinItemName() {
		return "lastCheckin_" + sid;
	}

	function getSessionItemName () {
		return "s_" + sid;
	}

	function isActiveSession() {
		var lastCheckin;
		var now = Date.now();
		var lastCheckinItemName = getLastCheckinItemName();

		lastCheckin = cleanNulls(localStorage.getItem(getLastCheckinItemName()));

		if (lastCheckin && (now - lastCheckin) >= config.sessionTimeout) {
			return false;
		}

		return true;
	}

	function resetSession() {
		localStorage.removeItem(getSessionItemName());
	}

	function doPing() {
		if (userActive) {

			var i;
			var s;

			try {
				i = cleanNulls(localStorage.getItem("i"));
				if (isActiveSession()) {
					s = cleanNulls(localStorage.getItem(getSessionItemName()));
				} else {
					resetSession();
				}
			} catch (e) {
				// Do nothing
				debugger;
			}

			tinyAjax.post(config.pingQueueUrl, {
				i: i,
				s: s,
				f: ctx.firstLoad.toString(),
				pid: pid,
				sid: sid,
				url: url,
				ref: ref,
				c: pingCount,
				ai: additionalInfo
			}, {
				withCredentials: true,
				callback: function (response) {
					ctx.firstLoad = false;
					if (!response.i) {
						//we don't have anyway to track the user, so we stop trying.
						return;
					}

					pingCount++;

					var events = response.e;
					ctx.pingInterval = setTimeout(doPing, config.pingInterval);
					if (events && events.length) {
						events.forEach(function (evt) {
							ctx.trigger(evt.eventName, evt);
						});
					}

					try {
						if (response.i) {
							localStorage.setItem("i", response.i);
						}

						if (response.s) {
							localStorage.setItem(getSessionItemName(), response.s);
						}

						localStorage.setItem(getLastCheckinItemName(), Date.now());

						return true;
					} catch (e) {
						return false;
					}


				},
				error: function () {
					// No args passed into error
					console.log('error');
					//ctx.pingInterval = setTimeout(doPing, config.pingInterval);;
				}
			});
		}
	}

	// AJAX fncs
	this.userActive = function () {
		ctx.pingInterval = setTimeout(doPing, 0);
	}

	this.userInactive = function () {
		if (ctx.pingInterval) {
			ctx.pingInterval = clearTimeout(ctx.pingInterval);
		}
	}
	this.setUserAlwaysActive = function () {
		userAlwaysActive = true;
		resetTimer();
		if (!ctx.pingInterval) {
			setTimeout(doPing, 0);
		}

	};
	this.unsetUserAlwaysActive = function () {
		userAlwaysActive = false;
		resetTimer();
		if (!ctx.pingInterval) {
			setTimeout(doPing, 0);
		}

	};

	function wireupInitialHandlers() {
		(evtOnLoad || []).forEach(function (event) {
			ctx.on.apply(ctx, event);
		});
	}

	// Public fncs
	this.setAdditionalInfo = function (args) {
		for (var prop in args) {
			additionalInfo[prop] = args[prop];
		}
	};
	this.trigger = function (evtName, args) {
		var evtMatch = null;
		for (var i = 0; i < this.events.length; i++) {
			if (this.events[i].eventName == evtName) {
				this.events[i].applyCallback(args);
			}
		}
	};
	this.on = function (evtName, callbackFnc) {
		// You are allowed to have multiple handlers for the same event name
		this.events.push(new trackerEvent(evtName, callbackFnc));
	};
	this.off = function (evtName) {
		// Loop through all events, mark each match as "deleted," then re-assign the this.events array
		this.events.forEach(function (trackerEvent) {
			if (trackerEvent.eventName == evtName) {
				trackerEvent.remove = true;
			}
		});
		var newEvents = [];
		this.events.forEach(function (trackerEvent) {
			if (!trackerEvent.remove) {
				newEvents.push(trackerEvent);
			}
		});
		this.events = newEvents;
	};
	this.init = function () {
		generatePid();
		wireupInitialHandlers();
		ctx.userActive();
		this.initialized = true;
	};
	// Go time!
	inactivityTime();
}
(function () {
	PureChat = function (socketUrl, userId, domainId, authToken, identifyStatus, errorStatus, restrictTransports, poppedOut, emailMD5Hash, reconnectLimit) {
		var t = this;
		this.currentUserId = userId;
		this.currentDomainId = domainId;
		this.currentAuthToken = authToken;
		this.poppedOut = poppedOut;
		this.emailMD5Hash = emailMD5Hash;
		t.setConnectionStatus(0);
		io.transports = ['websocket'];
		var socketConfig = {
			//'force new connection': true,
			'reconnection limit': 15000,
			'max reconnection attempts': reconnectLimit || Infinity
		};
		this.socket = io.connect(socketUrl, socketConfig);

		if (!this.socket.socket.connecting) {
			this.socket.socket.reconnect();
		}
		// stores socket.io messages that need to be sent out after the client registers callbacks
		this.messageQueue = [];

		// registers the handler for a message type - incoming messages will be sent to the callback if there is one, queued otherwise
		this.eventFncMappings = {};
		this.registerHandler = function (name) {
			var fnc = function (args) {
				if (callCallback[name]) {
					callCallback[name].call(t, args);
				} else {
					callCallback.default.call(t, name, args);
				}
			};
			t.eventFncMappings[name] = fnc;
			t.socket.on(name, t.eventFncMappings[name]);
		};
		this.chatServerEvents = [
			'message',
			'joined',
			'left',
			'roomdestroyed',
			'userDestroyed',
			'typing',
			'reidentify',
			'userdeleted',
			'chat-counts',
			'opInvite',
			'roomchanged',
			'roomclosed',
			'rooms',
			'onlineOperatorStatus',
			'opStatus',
			'serverNotice',
			'roomdetailschanged',
			'userSettings:change',
			'canned-responses:changed',
			'canned-responses:added',
			'canned-responses:deleted',
			'userOnboarding:change',
			'operator:refresh',
			'noOperatorJoined'
		];
		this.chatServerEvents.forEach(function (name) {
			t.registerHandler(name);
		});


		this.socket.on('connect', function () {
			this.reconnectCount = 0;
			t.setConnectionStatus(1);
			t.identify(t.currentUserId, t.currentDomainId, t.currentAuthToken, identifyStatus, t.poppedOut, t.emailMD5Hash);
			t.trigger('connection:connected:socketio');
		});

		this.socket.on('disconnect', function () {
			t.setConnectionStatus(0);
			console.log('Just disconnected...');
			t.trigger('connection:disconnected:socketio');
		});

		this.socket.on('reconnecting', function () {
			this.reconnectCount++
			console.log('reconnecting...');
			if (this.reconnectCount > 8) {
				t.setConnectionStatus(3);
			}
		});

		t.on('connection:retry:socketio', function () {
			var socket = t.socket.socket;
			if (!socket.connected && socket.reconnectionAttempts >= 8) {
				socket.reconnect();
			}
		});

		if (errorStatus)
			this.socket.on('error', errorStatus);
	};

	PureChat.prototype.setConnectionStatus = function (val) {
		this.status = val;
		this.trigger('change:connectionStatus', this, val);
	}

	PureChat.prototype.disconnect = function () {
		this.socket.disconnect();
		this.socket.socket.disconnect();
		this.socket.removeAllListeners();
		this.socket = null;
	};

	PureChat.prototype.identify = function (userId, domainId, authToken, status, poppedOut, emailMD5Hash) {
		var t = this;
		this.currentUserId = userId;
		this.currentDomainId = domainId;
		this.currentAuthToken = authToken;
		this.deviceType = PureChat.enums.deviceType.desktop;
		this.poppedOut = poppedOut;
		this.protocolVersion = '2.0';
		this.emailMD5Hash = emailMD5Hash;

		function identifiedCallback(success, response, errorCode, errorMessage) {
			if (success) {
				t.setConnectionStatus(2);
			}

			status.apply(this, arguments);
		};

		this.socket.emit('identify', {
			'userId': this.currentUserId,
			'domainId': this.currentDomainId,
			'authToken': this.currentAuthToken,
			'deviceType': this.deviceType,
			'deviceVersion': PureChat.deviceVersion,
			'poppedOut': this.poppedOut,
			'protocolVersion': this.protocolVersion,
			'emailMD5Hash': this.emailMD5Hash
		}, identifiedCallback);
	};

	PureChat.prototype.sendmessage = function (message, roomId, status) {
		this.socket.emit('sendmessage', { 'message': message, 'roomId': roomId }, status);
	};

	PureChat.prototype.sendtyping = function (roomId, isTyping, statusCallback) {
		this.socket.emit('sendtyping', { 'roomId': roomId, 'isTyping': isTyping }, statusCallback);
	};

	PureChat.prototype.destroyself = function (status, args) {
		this.socket.emit('destroyself', args || {}, status);
	};

	PureChat.prototype.join = function (args, status) {
		var roomId = args.roomId;
		var invisible = args.invisible;
		var joinType = args.joinType;

		this.socket.emit('join', { 'roomId': roomId, 'invisible': invisible, 'joinType': joinType }, status);
	};

	PureChat.prototype.leave = function (roomId, status) {
		this.socket.emit('leave', { 'roomId': roomId }, status);
	};

	PureChat.prototype.closeroom = function (roomId, status) {
		this.socket.emit('closeroom', { 'roomId': roomId }, status);
	};
	PureChat.prototype.createoperatorroom = function (roomName, otherUserIds, status, visitorEmailHash, visitorAvatarUrl) {
		this.socket.emit('createoperatorroom', { 'roomName': roomName, 'otherUserIds': otherUserIds }, status, visitorEmailHash, visitorAvatarUrl);
	};
	PureChat.prototype.sendcurrentstate = function (status) {
		this.socket.emit('sendcurrentstate', {}, status);
	};

	PureChat.prototype.getuser = function (status) {
		this.socket.emit('getuser', status);
	};

	PureChat.prototype.getusers = function (status) {
		this.socket.emit('getusers', status);
	};

	PureChat.prototype.sendroomhistory = function (roomId, status) {
		this.socket.emit('sendroomhistory', { 'roomId': roomId }, status);
	};

	PureChat.prototype.setavailable = function (userId, connectionId, available, statusCallback) {
		this.socket.emit('setavailable', { 'userId': userId, 'connectionId': connectionId, 'available': available }, statusCallback);
	};

	PureChat.prototype.setWidgetTypeAvailable = function (userId, widgetType, available, statusCallback) {
		this.socket.emit('setwidgettypeavailable', { 'userId': userId, 'widgetType': widgetType, 'available': available }, statusCallback);
	};

	PureChat.prototype.forcedisconnect = function (userId, connectionId, statusCallback) {
		this.socket.emit('forcedisconnect', { 'userId': userId, 'connectionId': connectionId }, statusCallback);
	};

	PureChat.prototype.startdemo = function (widgetId, statusCallback) {
		this.socket.emit('startdemo', { 'widgetId': widgetId }, statusCallback);
	};

	PureChat.prototype.sendInvite = function (userId, roomId, roomName, fromName, statusCallback) {
		this.socket.emit('opInvite', { 'userId': userId, 'roomId': roomId, 'roomName': roomName, 'fromName': fromName }, statusCallback);
	};

	PureChat.prototype.setVisitorDetails = function (roomId, details, statusCallback) {
		this.socket.emit('setvisitordetails', { 'roomId': roomId, 'details': details }, statusCallback);
	};

	PureChat.deviceVersion = 1.0;

	PureChat.enums = {
		deviceType: {
			desktop: 0,
			ios: 1
		},
		roomType: {
			account: 0,
			operator: 1,
			visitor: 2
		}
	};

	// private, context has to be set explicitly on call
	var callCallback = {
		'message': function (args) {
			var escapedUserDisplayName = args.userDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			var escapedRoomDisplayName = args.roomDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			var escapedMessage = (args.message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			this.trigger("message", args.userId, escapedUserDisplayName, args.roomId, escapedRoomDisplayName, args.time, escapedMessage.length > 0 ? escapedMessage : null, args.isHistory, args.timeElapsed, args.protocolVersion, args.avatarUrl, args.fromOperator, args.roomUtcOffset);
		},

		'joined': function (args) {
			var escapedUserDisplayName = args.userDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			var escapedRoomDisplayName = args.roomDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			this.trigger("joined", args.userId, escapedUserDisplayName, args.roomId, escapedRoomDisplayName, args.time, args.isHistory);
		},

		'left': function (args) {
			var escapedUserDisplayName = args.userDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			var escapedRoomDisplayName = args.roomDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			this.trigger("left", args.userId, escapedUserDisplayName, args.roomId, escapedRoomDisplayName, args.time, args.isHistory);
		},

		'roomdestroyed': function (args) {
			var escapedRoomDisplayName = args.roomDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			this.trigger("roomdestroyed", args.roomId, escapedRoomDisplayName, args.time, args.reasonCode);
		},
		'userDestroyed': function (args) {
			this.trigger("userDestroyed", args.userId);
		},

		'typing': function (args) {
			var escapedUserDisplayName = args.userDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			var escapedRoomDisplayName = args.roomDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			this.trigger("typing", args.userId, escapedUserDisplayName, args.roomId, args.roomDisplayName, args.isTyping, args.time);
		},
		'roomchanged': function (args) {
			if (args && args.action == "closedroom") {
				purechatApp.execute('roomclosed', args.room.id);
			}
			this.trigger('roomchanged', args);
		},
		'default': function (event, args) {
			this.trigger(event, args);
		}
	};

	//below is copied from backbone events.
	//might not be neccessary but I didn't want to rely on backbone here.
	var array = [];
	var push = array.push;
	var slice = array.slice;
	var splice = array.splice;


	PureChat.prototype.on = function (name, callback, context) {
		if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
		this._events || (this._events = {});
		var events = this._events[name] || (this._events[name] = []);
		events.push({ callback: callback, context: context, ctx: context || this });
		return this;
	};
	// Bind an event to only be triggered a single time. After the first time
	// the callback is invoked, it will be removed.
	PureChat.prototype.once = function (name, callback, context) {
		if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
		var self = this;
		var once = _.once(function () {
			self.off(name, once);
			callback.apply(this, arguments);
		});
		once._callback = callback;
		return this.on(name, once, context);
	};
	// Remove one or many callbacks. If `context` is null, removes all
	// callbacks with that function. If `callback` is null, removes all
	// callbacks for the event. If `name` is null, removes all bound
	// callbacks for all events.
	PureChat.prototype.off = function (name, callback, context) {
		var retain, ev, events, names, i, l, j, k;
		if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
		if (!name && !callback && !context) {
			this._events = void 0;
			return this;
		}
		names = name ? [name] : _.keys(this._events);
		for (i = 0, l = names.length; i < l; i++) {
			name = names[i];
			if (events = this._events[name]) {
				this._events[name] = retain = [];
				if (callback || context) {
					for (j = 0, k = events.length; j < k; j++) {
						ev = events[j];
						if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
						(context && context !== ev.context)) {
							retain.push(ev);
						}
					}
				}
				if (!retain.length) delete this._events[name];
			}
		}

		return this;
	};
	// Trigger one or many events, firing all bound callbacks. Callbacks are
	// passed the same arguments as `trigger` is, apart from the event name
	// (unless you're listening on `"all"`, which will cause your callback to
	// receive the true name of the event as the first argument).
	PureChat.prototype.trigger = function (name) {
		if (!this._events) return this;
		var args = slice.call(arguments, 1);
		if (!eventsApi(this, 'trigger', name, args)) return this;
		var events = this._events[name];
		var allEvents = this._events.all;
		if (events) triggerEvents(events, args);
		if (allEvents) triggerEvents(allEvents, arguments);
		return this;
	};
	// Tell this object to stop listening to either specific events ... or
	// to every object it's currently listening to.
	PureChat.prototype.stopListening = function (obj, name, callback) {
		var listeningTo = this._listeningTo;
		if (!listeningTo) return this;
		var remove = !name && !callback;
		if (!callback && typeof name === 'object') callback = this;
		if (obj) (listeningTo = {})[obj._listenId] = obj;
		for (var id in listeningTo) {
			obj = listeningTo[id];
			obj.off(name, callback, this);
			if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
		}
		return this;
	};


	// Regular expression used to split event strings.
	var eventSplitter = /\s+/;

	// Implement fancy features of the Events API such as multiple event
	// names `"change blur"` and jQuery-style event maps `{change: action}`
	// in terms of the existing API.
	var eventsApi = function (obj, action, name, rest) {
		if (!name) return true;

		// Handle event maps.
		if (typeof name === 'object') {
			for (var key in name) {
				obj[action].apply(obj, [key, name[key]].concat(rest));
			}
			return false;
		}

		// Handle space separated event names.
		if (eventSplitter.test(name)) {
			var names = name.split(eventSplitter);
			for (var i = 0, l = names.length; i < l; i++) {
				obj[action].apply(obj, [names[i]].concat(rest));
			}
			return false;
		}

		return true;
	};

	// A difficult-to-believe, but optimized internal dispatch function for
	// triggering events. Tries to keep the usual cases speedy (most internal
	// Backbone events have 3 arguments).
	var triggerEvents = function (events, args) {
		var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
		switch (args.length) {
			case 0:
				while (++i < l) (ev = events[i]).callback.call(ev.ctx);
				return;
			case 1:
				while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1);
				return;
			case 2:
				while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2);
				return;
			case 3:
				while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
				return;
			default:
				while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
		}
	};

}());
exports = undefined;

var global$ = window.$;
var $ = window.$pureChatJquery;
//     Underscore.js 1.8.2
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.
(function() {
	function n(n) {
		function t(t, r, e, u, i, o) {
			for (; i >= 0 && o > i; i += n) {
				var a = u ? u[i] : i;
				e = r(e, t[a], a, t)
			}
			return e
		}

		return function(r, e, u, i) {
			e = d(e, i, 4);
			var o = !w(r) && m.keys(r), a = (o || r).length, c = n > 0 ? 0 : a - 1;
			return arguments.length < 3 && (u = r[o ? o[c] : c], c += n), t(r, e, u, o, c, a)
		}
	}

	function t(n) {
		return function(t, r, e) {
			r = b(r, e);
			for (var u = null != t && t.length, i = n > 0 ? 0 : u - 1; i >= 0 && u > i; i += n) if (r(t[i], i, t)) return i;
			return -1
		}
	}

	function r(n, t) {
		var r = S.length, e = n.constructor, u = m.isFunction(e) && e.prototype || o, i = "constructor";
		for (m.has(n, i) && !m.contains(t, i) && t.push(i); r--;) i = S[r], i in n && n[i] !== u[i] && !m.contains(t, i) && t.push(i)
	}

	var e = this, u = e._, i = Array.prototype, o = Object.prototype, a = Function.prototype, c = i.push, l = i.slice, f = o.toString, s = o.hasOwnProperty, p = Array.isArray, h = Object.keys, v = a.bind, g = Object.create, y = function() {}, m = function(n) { return n instanceof m ? n : this instanceof m ? void (this._wrapped = n) : new m(n) };
	"undefined" != typeof exports ? ("undefined" != typeof module && module.exports && (exports = module.exports = m), exports._ = m) : e._ = m, m.VERSION = "1.8.2";
	var d = function(n, t, r) {
		    if (t === void 0) return n;
		    switch (null == r ? 3 : r) {
		    case 1:
			    return function(r) { return n.call(t, r) };
		    case 2:
			    return function(r, e) { return n.call(t, r, e) };
		    case 3:
			    return function(r, e, u) { return n.call(t, r, e, u) };
		    case 4:
			    return function(r, e, u, i) { return n.call(t, r, e, u, i) }
		    }
		    return function() { return n.apply(t, arguments) }
	    },
		b = function(n, t, r) { return null == n ? m.identity : m.isFunction(n) ? d(n, t, r) : m.isObject(n) ? m.matcher(n) : m.property(n) };
	m.iteratee = function(n, t) { return b(n, t, 1 / 0) };
	var x = function(n, t) {
		    return function(r) {
			    var e = arguments.length;
			    if (2 > e || null == r) return r;
			    for (var u = 1; e > u; u++)
				    for (var i = arguments[u], o = n(i), a = o.length, c = 0; a > c; c++) {
					    var l = o[c];
					    t && r[l] !== void 0 || (r[l] = i[l])
				    }
			    return r
		    }
	    },
		_ = function(n) {
			if (!m.isObject(n)) return {};
			if (g) return g(n);
			y.prototype = n;
			var t = new y;
			return y.prototype = null, t
		},
		j = Math.pow(2, 53) - 1,
		w = function(n) {
			var t = n && n.length;
			return "number" == typeof t && t >= 0 && j >= t
		};
	m.each = m.forEach = function(n, t, r) {
		t = d(t, r);
		var e, u;
		if (w(n)) for (e = 0, u = n.length; u > e; e++) t(n[e], e, n);
		else {
			var i = m.keys(n);
			for (e = 0, u = i.length; u > e; e++) t(n[i[e]], i[e], n)
		}
		return n
	}, m.map = m.collect = function(n, t, r) {
		t = b(t, r);
		for (var e = !w(n) && m.keys(n), u = (e || n).length, i = Array(u), o = 0; u > o; o++) {
			var a = e ? e[o] : o;
			i[o] = t(n[a], a, n)
		}
		return i
	}, m.reduce = m.foldl = m.inject = n(1), m.reduceRight = m.foldr = n(-1), m.find = m.detect = function(n, t, r) {
		var e;
		return e = w(n) ? m.findIndex(n, t, r) : m.findKey(n, t, r), e !== void 0 && e !== -1 ? n[e] : void 0
	}, m.filter = m.select = function(n, t, r) {
		var e = [];
		return t = b(t, r), m.each(n, function(n, r, u) { t(n, r, u) && e.push(n) }), e
	}, m.reject = function(n, t, r) { return m.filter(n, m.negate(b(t)), r) }, m.every = m.all = function(n, t, r) {
		t = b(t, r);
		for (var e = !w(n) && m.keys(n), u = (e || n).length, i = 0; u > i; i++) {
			var o = e ? e[i] : i;
			if (!t(n[o], o, n)) return !1
		}
		return !0
	}, m.some = m.any = function(n, t, r) {
		t = b(t, r);
		for (var e = !w(n) && m.keys(n), u = (e || n).length, i = 0; u > i; i++) {
			var o = e ? e[i] : i;
			if (t(n[o], o, n)) return !0
		}
		return !1
	}, m.contains = m.includes = m.include = function(n, t, r) { return w(n) || (n = m.values(n)), m.indexOf(n, t, "number" == typeof r && r) >= 0 }, m.invoke = function(n, t) {
		var r = l.call(arguments, 2), e = m.isFunction(t);
		return m.map(n, function(n) {
			var u = e ? t : n[t];
			return null == u ? u : u.apply(n, r)
		})
	}, m.pluck = function(n, t) { return m.map(n, m.property(t)) }, m.where = function(n, t) { return m.filter(n, m.matcher(t)) }, m.findWhere = function(n, t) { return m.find(n, m.matcher(t)) }, m.max = function(n, t, r) {
		var e, u, i = -1 / 0, o = -1 / 0;
		if (null == t && null != n) {
			n = w(n) ? n : m.values(n);
			for (var a = 0, c = n.length; c > a; a++) e = n[a], e > i && (i = e)
		} else t = b(t, r), m.each(n, function(n, r, e) { u = t(n, r, e), (u > o || u === -1 / 0 && i === -1 / 0) && (i = n, o = u) });
		return i
	}, m.min = function(n, t, r) {
		var e, u, i = 1 / 0, o = 1 / 0;
		if (null == t && null != n) {
			n = w(n) ? n : m.values(n);
			for (var a = 0, c = n.length; c > a; a++) e = n[a], i > e && (i = e)
		} else t = b(t, r), m.each(n, function(n, r, e) { u = t(n, r, e), (o > u || 1 / 0 === u && 1 / 0 === i) && (i = n, o = u) });
		return i
	}, m.shuffle = function(n) {
		for (var t, r = w(n) ? n : m.values(n), e = r.length, u = Array(e), i = 0; e > i; i++) t = m.random(0, i), t !== i && (u[i] = u[t]), u[t] = r[i];
		return u
	}, m.sample = function(n, t, r) { return null == t || r ? (w(n) || (n = m.values(n)), n[m.random(n.length - 1)]) : m.shuffle(n).slice(0, Math.max(0, t)) }, m.sortBy = function(n, t, r) {
		return t = b(t, r), m.pluck(m.map(n, function(n, r, e) { return { value: n, index: r, criteria: t(n, r, e) } }).sort(function(n, t) {
			var r = n.criteria, e = t.criteria;
			if (r !== e) {
				if (r > e || r === void 0) return 1;
				if (e > r || e === void 0) return -1
			}
			return n.index - t.index
		}), "value")
	};
	var A = function(n) {
		return function(t, r, e) {
			var u = {};
			return r = b(r, e), m.each(t, function(e, i) {
				var o = r(e, i, t);
				n(u, e, o)
			}), u
		}
	};
	m.groupBy = A(function(n, t, r) { m.has(n, r) ? n[r].push(t) : n[r] = [t] }), m.indexBy = A(function(n, t, r) { n[r] = t }), m.countBy = A(function(n, t, r) { m.has(n, r) ? n[r]++ : n[r] = 1 }), m.toArray = function(n) { return n ? m.isArray(n) ? l.call(n) : w(n) ? m.map(n, m.identity) : m.values(n) : [] }, m.size = function(n) { return null == n ? 0 : w(n) ? n.length : m.keys(n).length }, m.partition = function(n, t, r) {
		t = b(t, r);
		var e = [], u = [];
		return m.each(n, function(n, r, i) { (t(n, r, i) ? e : u).push(n) }), [e, u]
	}, m.first = m.head = m.take = function(n, t, r) { return null == n ? void 0 : null == t || r ? n[0] : m.initial(n, n.length - t) }, m.initial = function(n, t, r) { return l.call(n, 0, Math.max(0, n.length - (null == t || r ? 1 : t))) }, m.last = function(n, t, r) { return null == n ? void 0 : null == t || r ? n[n.length - 1] : m.rest(n, Math.max(0, n.length - t)) }, m.rest = m.tail = m.drop = function(n, t, r) { return l.call(n, null == t || r ? 1 : t) }, m.compact = function(n) { return m.filter(n, m.identity) };
	var k = function(n, t, r, e) {
		for (var u = [], i = 0, o = e || 0, a = n && n.length; a > o; o++) {
			var c = n[o];
			if (w(c) && (m.isArray(c) || m.isArguments(c))) {
				t || (c = k(c, t, r));
				var l = 0, f = c.length;
				for (u.length += f; f > l;) u[i++] = c[l++]
			} else r || (u[i++] = c)
		}
		return u
	};
	m.flatten = function(n, t) { return k(n, t, !1) }, m.without = function(n) { return m.difference(n, l.call(arguments, 1)) }, m.uniq = m.unique = function(n, t, r, e) {
		if (null == n) return [];
		m.isBoolean(t) || (e = r, r = t, t = !1), null != r && (r = b(r, e));
		for (var u = [], i = [], o = 0, a = n.length; a > o; o++) {
			var c = n[o], l = r ? r(c, o, n) : c;
			t ? (o && i === l || u.push(c), i = l) : r ? m.contains(i, l) || (i.push(l), u.push(c)) : m.contains(u, c) || u.push(c)
		}
		return u
	}, m.union = function() { return m.uniq(k(arguments, !0, !0)) }, m.intersection = function(n) {
		if (null == n) return [];
		for (var t = [], r = arguments.length, e = 0, u = n.length; u > e; e++) {
			var i = n[e];
			if (!m.contains(t, i)) {
				for (var o = 1; r > o && m.contains(arguments[o], i); o++);
				o === r && t.push(i)
			}
		}
		return t
	}, m.difference = function(n) {
		var t = k(arguments, !0, !0, 1);
		return m.filter(n, function(n) { return !m.contains(t, n) })
	}, m.zip = function() { return m.unzip(arguments) }, m.unzip = function(n) {
		for (var t = n && m.max(n, "length").length || 0, r = Array(t), e = 0; t > e; e++) r[e] = m.pluck(n, e);
		return r
	}, m.object = function(n, t) {
		for (var r = {}, e = 0, u = n && n.length; u > e; e++) t ? r[n[e]] = t[e] : r[n[e][0]] = n[e][1];
		return r
	}, m.indexOf = function(n, t, r) {
		var e = 0, u = n && n.length;
		if ("number" == typeof r) e = 0 > r ? Math.max(0, u + r) : r;
		else if (r && u) return e = m.sortedIndex(n, t), n[e] === t ? e : -1;
		if (t !== t) return m.findIndex(l.call(n, e), m.isNaN);
		for (; u > e; e++) if (n[e] === t) return e;
		return -1
	}, m.lastIndexOf = function(n, t, r) {
		var e = n ? n.length : 0;
		if ("number" == typeof r && (e = 0 > r ? e + r + 1 : Math.min(e, r + 1)), t !== t) return m.findLastIndex(l.call(n, 0, e), m.isNaN);
		for (; --e >= 0;) if (n[e] === t) return e;
		return -1
	}, m.findIndex = t(1), m.findLastIndex = t(-1), m.sortedIndex = function(n, t, r, e) {
		r = b(r, e, 1);
		for (var u = r(t), i = 0, o = n.length; o > i;) {
			var a = Math.floor((i + o) / 2);
			r(n[a]) < u ? i = a + 1 : o = a
		}
		return i
	}, m.range = function(n, t, r) {
		arguments.length <= 1 && (t = n || 0, n = 0), r = r || 1;
		for (var e = Math.max(Math.ceil((t - n) / r), 0), u = Array(e), i = 0; e > i; i++, n += r) u[i] = n;
		return u
	};
	var O = function(n, t, r, e, u) {
		if (!(e instanceof t)) return n.apply(r, u);
		var i = _(n.prototype), o = n.apply(i, u);
		return m.isObject(o) ? o : i
	};
	m.bind = function(n, t) {
		if (v && n.bind === v) return v.apply(n, l.call(arguments, 1));
		if (!m.isFunction(n)) throw new TypeError("Bind must be called on a function");
		var r = l.call(arguments, 2), e = function() { return O(n, e, t, this, r.concat(l.call(arguments))) };
		return e
	}, m.partial = function(n) {
		var t = l.call(arguments, 1),
			r = function() {
				for (var e = 0, u = t.length, i = Array(u), o = 0; u > o; o++) i[o] = t[o] === m ? arguments[e++] : t[o];
				for (; e < arguments.length;) i.push(arguments[e++]);
				return O(n, r, this, this, i)
			};
		return r
	}, m.bindAll = function(n) {
		var t, r, e = arguments.length;
		if (1 >= e) throw new Error("bindAll must be passed function names");
		for (t = 1; e > t; t++) r = arguments[t], n[r] = m.bind(n[r], n);
		return n
	}, m.memoize = function(n, t) {
		var r = function(e) {
			var u = r.cache, i = "" + (t ? t.apply(this, arguments) : e);
			return m.has(u, i) || (u[i] = n.apply(this, arguments)), u[i]
		};
		return r.cache = {}, r
	}, m.delay = function(n, t) {
		var r = l.call(arguments, 2);
		return setTimeout(function() { return n.apply(null, r) }, t)
	}, m.defer = m.partial(m.delay, m, 1), m.throttle = function(n, t, r) {
		var e, u, i, o = null, a = 0;
		r || (r = {});
		var c = function() { a = r.leading === !1 ? 0 : m.now(), o = null, i = n.apply(e, u), o || (e = u = null) };
		return function() {
			var l = m.now();
			a || r.leading !== !1 || (a = l);
			var f = t - (l - a);
			return e = this, u = arguments, 0 >= f || f > t ? (o && (clearTimeout(o), o = null), a = l, i = n.apply(e, u), o || (e = u = null)) : o || r.trailing === !1 || (o = setTimeout(c, f)), i
		}
	}, m.debounce = function(n, t, r) {
		var e, u, i, o, a,
			c = function() {
				var l = m.now() - o;
				t > l && l >= 0 ? e = setTimeout(c, t - l) : (e = null, r || (a = n.apply(i, u), e || (i = u = null)))
			};
		return function() {
			i = this, u = arguments, o = m.now();
			var l = r && !e;
			return e || (e = setTimeout(c, t)), l && (a = n.apply(i, u), i = u = null), a
		}
	}, m.wrap = function(n, t) { return m.partial(t, n) }, m.negate = function(n) { return function() { return !n.apply(this, arguments) } }, m.compose = function() {
		var n = arguments, t = n.length - 1;
		return function() {
			for (var r = t, e = n[t].apply(this, arguments); r--;) e = n[r].call(this, e);
			return e
		}
	}, m.after = function(n, t) { return function() { return --n < 1 ? t.apply(this, arguments) : void 0 } }, m.before = function(n, t) {
		var r;
		return function() { return --n > 0 && (r = t.apply(this, arguments)), 1 >= n && (t = null), r }
	}, m.once = m.partial(m.before, 2);
	var F = !{ toString: null }.propertyIsEnumerable("toString"), S = ["valueOf", "isPrototypeOf", "toString", "propertyIsEnumerable", "hasOwnProperty", "toLocaleString"];
	m.keys = function(n) {
		if (!m.isObject(n)) return [];
		if (h) return h(n);
		var t = [];
		for (var e in n) m.has(n, e) && t.push(e);
		return F && r(n, t), t
	}, m.allKeys = function(n) {
		if (!m.isObject(n)) return [];
		var t = [];
		for (var e in n) t.push(e);
		return F && r(n, t), t
	}, m.values = function(n) {
		for (var t = m.keys(n), r = t.length, e = Array(r), u = 0; r > u; u++) e[u] = n[t[u]];
		return e
	}, m.mapObject = function(n, t, r) {
		t = b(t, r);
		for (var e, u = m.keys(n), i = u.length, o = {}, a = 0; i > a; a++) e = u[a], o[e] = t(n[e], e, n);
		return o
	}, m.pairs = function(n) {
		for (var t = m.keys(n), r = t.length, e = Array(r), u = 0; r > u; u++) e[u] = [t[u], n[t[u]]];
		return e
	}, m.invert = function(n) {
		for (var t = {}, r = m.keys(n), e = 0, u = r.length; u > e; e++) t[n[r[e]]] = r[e];
		return t
	}, m.functions = m.methods = function(n) {
		var t = [];
		for (var r in n) m.isFunction(n[r]) && t.push(r);
		return t.sort()
	}, m.extend = x(m.allKeys), m.extendOwn = m.assign = x(m.keys), m.findKey = function(n, t, r) {
		t = b(t, r);
		for (var e, u = m.keys(n), i = 0, o = u.length; o > i; i++) if (e = u[i], t(n[e], e, n)) return e
	}, m.pick = function(n, t, r) {
		var e, u, i = {}, o = n;
		if (null == o) return i;
		m.isFunction(t) ? (u = m.allKeys(o), e = d(t, r)) : (u = k(arguments, !1, !1, 1), e = function(n, t, r) { return t in r }, o = Object(o));
		for (var a = 0, c = u.length; c > a; a++) {
			var l = u[a], f = o[l];
			e(f, l, o) && (i[l] = f)
		}
		return i
	}, m.omit = function(n, t, r) {
		if (m.isFunction(t)) t = m.negate(t);
		else {
			var e = m.map(k(arguments, !1, !1, 1), String);
			t = function(n, t) { return !m.contains(e, t) }
		}
		return m.pick(n, t, r)
	}, m.defaults = x(m.allKeys, !0), m.clone = function(n) { return m.isObject(n) ? m.isArray(n) ? n.slice() : m.extend({}, n) : n }, m.tap = function(n, t) { return t(n), n }, m.isMatch = function(n, t) {
		var r = m.keys(t), e = r.length;
		if (null == n) return !e;
		for (var u = Object(n), i = 0; e > i; i++) {
			var o = r[i];
			if (t[o] !== u[o] || !(o in u)) return !1
		}
		return !0
	};
	var E = function(n, t, r, e) {
		if (n === t) return 0 !== n || 1 / n === 1 / t;
		if (null == n || null == t) return n === t;
		n instanceof m && (n = n._wrapped), t instanceof m && (t = t._wrapped);
		var u = f.call(n);
		if (u !== f.call(t)) return !1;
		switch (u) {
		case "[object RegExp]":
		case "[object String]":
			return "" + n == "" + t;
		case "[object Number]":
			return +n !== +n ? +t !== +t : 0 === +n ? 1 / +n === 1 / t : +n === +t;
		case "[object Date]":
		case "[object Boolean]":
			return +n === +t
		}
		var i = "[object Array]" === u;
		if (!i) {
			if ("object" != typeof n || "object" != typeof t) return !1;
			var o = n.constructor, a = t.constructor;
			if (o !== a && !(m.isFunction(o) && o instanceof o && m.isFunction(a) && a instanceof a) && "constructor" in n && "constructor" in t) return !1
		}
		r = r || [], e = e || [];
		for (var c = r.length; c--;) if (r[c] === n) return e[c] === t;
		if (r.push(n), e.push(t), i) {
			if (c = n.length, c !== t.length) return !1;
			for (; c--;) if (!E(n[c], t[c], r, e)) return !1
		} else {
			var l, s = m.keys(n);
			if (c = s.length, m.keys(t).length !== c) return !1;
			for (; c--;) if (l = s[c], !m.has(t, l) || !E(n[l], t[l], r, e)) return !1
		}
		return r.pop(), e.pop(), !0
	};
	m.isEqual = function(n, t) { return E(n, t) }, m.isEmpty = function(n) { return null == n ? !0 : w(n) && (m.isArray(n) || m.isString(n) || m.isArguments(n)) ? 0 === n.length : 0 === m.keys(n).length }, m.isElement = function(n) { return !(!n || 1 !== n.nodeType) }, m.isArray = p || function(n) { return "[object Array]" === f.call(n) }, m.isObject = function(n) {
		var t = typeof n;
		return "function" === t || "object" === t && !!n
	}, m.each(["Arguments", "Function", "String", "Number", "Date", "RegExp", "Error"], function(n) { m["is" + n] = function(t) { return f.call(t) === "[object " + n + "]" } }), m.isArguments(arguments) || (m.isArguments = function(n) { return m.has(n, "callee") }), "function" != typeof /./ && "object" != typeof Int8Array && (m.isFunction = function(n) { return "function" == typeof n || !1 }), m.isFinite = function(n) { return isFinite(n) && !isNaN(parseFloat(n)) }, m.isNaN = function(n) { return m.isNumber(n) && n !== +n }, m.isBoolean = function(n) { return n === !0 || n === !1 || "[object Boolean]" === f.call(n) }, m.isNull = function(n) { return null === n }, m.isUndefined = function(n) { return n === void 0 }, m.has = function(n, t) { return null != n && s.call(n, t) }, m.noConflict = function() { return e._ = u, this }, m.identity = function(n) { return n }, m.constant = function(n) { return function() { return n } }, m.noop = function() {}, m.property = function(n) { return function(t) { return null == t ? void 0 : t[n] } }, m.propertyOf = function(n) { return null == n ? function() {} : function(t) { return n[t] } }, m.matcher = m.matches = function(n) { return n = m.extendOwn({}, n), function(t) { return m.isMatch(t, n) } }, m.times = function(n, t, r) {
		var e = Array(Math.max(0, n));
		t = d(t, r, 1);
		for (var u = 0; n > u; u++) e[u] = t(u);
		return e
	}, m.random = function(n, t) { return null == t && (t = n, n = 0), n + Math.floor(Math.random() * (t - n + 1)) }, m.now = Date.now || function() { return (new Date).getTime() };
	var M = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "`": "&#x60;" }, N = m.invert(M),
		I = function(n) {
			var t = function(t) { return n[t] }, r = "(?:" + m.keys(n).join("|") + ")", e = RegExp(r), u = RegExp(r, "g");
			return function(n) { return n = null == n ? "" : "" + n, e.test(n) ? n.replace(u, t) : n }
		};
	m.escape = I(M), m.unescape = I(N), m.result = function(n, t, r) {
		var e = null == n ? void 0 : n[t];
		return e === void 0 && (e = r), m.isFunction(e) ? e.call(n) : e
	};
	var B = 0;
	m.uniqueId = function(n) {
		var t = ++B + "";
		return n ? n + t : t
	}, m.templateSettings = { evaluate: /<%([\s\S]+?)%>/g, interpolate: /<%=([\s\S]+?)%>/g, escape: /<%-([\s\S]+?)%>/g };
	var T = /(.)^/, R = { "'": "'", "\\": "\\", "\r": "r", "\n": "n", "\u2028": "u2028", "\u2029": "u2029" }, q = /\\|'|\r|\n|\u2028|\u2029/g, K = function(n) { return "\\" + R[n] };
	m.template = function(n, t, r) {
		!t && r && (t = r), t = m.defaults({}, t, m.templateSettings);
		var e = RegExp([(t.escape || T).source, (t.interpolate || T).source, (t.evaluate || T).source].join("|") + "|$", "g"), u = 0, i = "__p+='";
		n.replace(e, function(t, r, e, o, a) { return i += n.slice(u, a).replace(q, K), u = a + t.length, r ? i += "'+\n((__t=(" + r + "))==null?'':_.escape(__t))+\n'" : e ? i += "'+\n((__t=(" + e + "))==null?'':__t)+\n'" : o && (i += "';\n" + o + "\n__p+='"), t }), i += "';\n", t.variable || (i = "with(obj||{}){\n" + i + "}\n"), i = "var __t,__p='',__j=Array.prototype.join," + "print=function(){__p+=__j.call(arguments,'');};\n" + i + "return __p;\n";
		try {
			var o = new Function(t.variable || "obj", "_", i)
		} catch (a) {
			throw a.source = i, a
		}
		var c = function(n) { return o.call(this, n, m) }, l = t.variable || "obj";
		return c.source = "function(" + l + "){\n" + i + "}", c
	}, m.chain = function(n) {
		var t = m(n);
		return t._chain = !0, t
	};
	var z = function(n, t) { return n._chain ? m(t).chain() : t };
	m.mixin = function(n) {
		m.each(m.functions(n), function(t) {
			var r = m[t] = n[t];
			m.prototype[t] = function() {
				var n = [this._wrapped];
				return c.apply(n, arguments), z(this, r.apply(m, n))
			}
		})
	}, m.mixin(m), m.each(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function(n) {
		var t = i[n];
		m.prototype[n] = function() {
			var r = this._wrapped;
			return t.apply(r, arguments), "shift" !== n && "splice" !== n || 0 !== r.length || delete r[0], z(this, r)
		}
	}), m.each(["concat", "join", "slice"], function(n) {
		var t = i[n];
		m.prototype[n] = function() { return z(this, t.apply(this._wrapped, arguments)) }
	}), m.prototype.value = function() { return this._wrapped }, m.prototype.valueOf = m.prototype.toJSON = m.prototype.value, m.prototype.toString = function() { return "" + this._wrapped }, "function" == typeof define && define.amd && define("underscore", [], function() { return m })
}).call(this);
//# sourceMappingURL=underscore-min.map
//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(root, factory) {

	// Set up Backbone appropriately for the environment. Start with AMD.
	//if (typeof define === 'function' && define.amd) {
	//	define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
	//		// Export global even in AMD case in case this script is loaded with
	//		// others that may still expect a global Backbone.
	//		root.Backbone = factory(root, exports, _, $);
	//	});

	//	// Next for Node.js or CommonJS. jQuery may not be needed as a module.
	//} else if (typeof exports !== 'undefined') {
	//	var _ = require('underscore');
	//	factory(root, exports, _);

	//	// Finally, as a browser global.
	//} else {
	root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
	//}

}(this, function(root, Backbone, _, $) {

	// Initial Setup
	// -------------

	// Save the previous value of the `Backbone` variable, so that it can be
	// restored later on, if `noConflict` is used.
	var previousBackbone = root.Backbone;

	// Create local references to array methods we'll want to use later.
	var array = [];
	var push = array.push;
	var slice = array.slice;
	var splice = array.splice;

	// Current version of the library. Keep in sync with `package.json`.
	Backbone.VERSION = '1.1.2';

	// For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
	// the `$` variable.
	Backbone.$ = $;

	// Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
	// to its previous owner. Returns a reference to this Backbone object.
	Backbone.noConflict = function() {
		root.Backbone = previousBackbone;
		return this;
	};

	// Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
	// will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
	// set a `X-Http-Method-Override` header.
	Backbone.emulateHTTP = false;

	// Turn on `emulateJSON` to support legacy servers that can't deal with direct
	// `application/json` requests ... will encode the body as
	// `application/x-www-form-urlencoded` instead and will send the model in a
	// form param named `model`.
	Backbone.emulateJSON = false;

	// Backbone.Events
	// ---------------

	// A module that can be mixed in to *any object* in order to provide it with
	// custom events. You may bind with `on` or remove with `off` callback
	// functions to an event; `trigger`-ing an event fires all callbacks in
	// succession.
	//
	//     var object = {};
	//     _.extend(object, Backbone.Events);
	//     object.on('expand', function(){ alert('expanded'); });
	//     object.trigger('expand');
	//
	var Events = Backbone.Events = {

		// Bind an event to a `callback` function. Passing `"all"` will bind
		// the callback to all events fired.
		on: function(name, callback, context) {
			if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
			this._events || (this._events = {});
			var events = this._events[name] || (this._events[name] = []);
			events.push({ callback: callback, context: context, ctx: context || this });
			return this;
		},

		// Bind an event to only be triggered a single time. After the first time
		// the callback is invoked, it will be removed.
		once: function(name, callback, context) {
			if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
			var self = this;
			var once = _.once(function() {
				self.off(name, once);
				callback.apply(this, arguments);
			});
			once._callback = callback;
			return this.on(name, once, context);
		},

		// Remove one or many callbacks. If `context` is null, removes all
		// callbacks with that function. If `callback` is null, removes all
		// callbacks for the event. If `name` is null, removes all bound
		// callbacks for all events.
		off: function(name, callback, context) {
			var retain, ev, events, names, i, l, j, k;
			if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
			if (!name && !callback && !context) {
				this._events = void 0;
				return this;
			}
			names = name ? [name] : _.keys(this._events);
			for (i = 0, l = names.length; i < l; i++) {
				name = names[i];
				if (events = this._events[name]) {
					this._events[name] = retain = [];
					if (callback || context) {
						for (j = 0, k = events.length; j < k; j++) {
							ev = events[j];
							if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
							(context && context !== ev.context)) {
								retain.push(ev);
							}
						}
					}
					if (!retain.length) delete this._events[name];
				}
			}

			return this;
		},

		// Trigger one or many events, firing all bound callbacks. Callbacks are
		// passed the same arguments as `trigger` is, apart from the event name
		// (unless you're listening on `"all"`, which will cause your callback to
		// receive the true name of the event as the first argument).
		trigger: function(name) {
			if (!this._events) return this;
			var args = slice.call(arguments, 1);
			if (!eventsApi(this, 'trigger', name, args)) return this;
			var events = this._events[name];
			var allEvents = this._events.all;
			if (events) triggerEvents(events, args);
			if (allEvents) triggerEvents(allEvents, arguments);
			return this;
		},

		// Tell this object to stop listening to either specific events ... or
		// to every object it's currently listening to.
		stopListening: function(obj, name, callback) {
			var listeningTo = this._listeningTo;
			if (!listeningTo) return this;
			var remove = !name && !callback;
			if (!callback && typeof name === 'object') callback = this;
			if (obj) (listeningTo = {})[obj._listenId] = obj;
			for (var id in listeningTo) {
				obj = listeningTo[id];
				obj.off(name, callback, this);
				if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
			}
			return this;
		}

	};

	// Regular expression used to split event strings.
	var eventSplitter = /\s+/;

	// Implement fancy features of the Events API such as multiple event
	// names `"change blur"` and jQuery-style event maps `{change: action}`
	// in terms of the existing API.
	var eventsApi = function(obj, action, name, rest) {
		if (!name) return true;

		// Handle event maps.
		if (typeof name === 'object') {
			for (var key in name) {
				obj[action].apply(obj, [key, name[key]].concat(rest));
			}
			return false;
		}

		// Handle space separated event names.
		if (eventSplitter.test(name)) {
			var names = name.split(eventSplitter);
			for (var i = 0, l = names.length; i < l; i++) {
				obj[action].apply(obj, [names[i]].concat(rest));
			}
			return false;
		}

		return true;
	};

	// A difficult-to-believe, but optimized internal dispatch function for
	// triggering events. Tries to keep the usual cases speedy (most internal
	// Backbone events have 3 arguments).
	var triggerEvents = function(events, args) {
		var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
		switch (args.length) {
		case 0:
			while (++i < l) (ev = events[i]).callback.call(ev.ctx);
			return;
		case 1:
			while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1);
			return;
		case 2:
			while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2);
			return;
		case 3:
			while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
			return;
		default:
			while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
			return;
		}
	};

	var listenMethods = { listenTo: 'on', listenToOnce: 'once' };

	// Inversion-of-control versions of `on` and `once`. Tell *this* object to
	// listen to an event in another object ... keeping track of what it's
	// listening to.
	_.each(listenMethods, function(implementation, method) {
		Events[method] = function(obj, name, callback) {
			var listeningTo = this._listeningTo || (this._listeningTo = {});
			var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
			listeningTo[id] = obj;
			if (!callback && typeof name === 'object') callback = this;
			obj[implementation](name, callback, this);
			return this;
		};
	});

	// Aliases for backwards compatibility.
	Events.bind = Events.on;
	Events.unbind = Events.off;

	// Allow the `Backbone` object to serve as a global event bus, for folks who
	// want global "pubsub" in a convenient place.
	_.extend(Backbone, Events);

	// Backbone.Model
	// --------------

	// Backbone **Models** are the basic data object in the framework --
	// frequently representing a row in a table in a database on your server.
	// A discrete chunk of data and a bunch of useful, related methods for
	// performing computations and transformations on that data.

	// Create a new model with the specified attributes. A client id (`cid`)
	// is automatically generated and assigned for you.
	var Model = Backbone.Model = function(attributes, options) {
		var attrs = attributes || {};
		options || (options = {});
		this.cid = _.uniqueId('c');
		this.attributes = {};
		if (options.collection) this.collection = options.collection;
		if (options.parse) attrs = this.parse(attrs, options) || {};
		attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
		this.set(attrs, options);
		this.changed = {};
		this.initialize.apply(this, arguments);
	};

	// Attach all inheritable methods to the Model prototype.
	_.extend(Model.prototype, Events, {

		// A hash of attributes whose current and previous value differ.
		changed: null,

		// The value returned during the last failed validation.
		validationError: null,

		// The default name for the JSON `id` attribute is `"id"`. MongoDB and
		// CouchDB users may want to set this to `"_id"`.
		idAttribute: 'id',

		// Initialize is an empty function by default. Override it with your own
		// initialization logic.
		initialize: function() {},

		// Return a copy of the model's `attributes` object.
		toJSON: function(options) {
			return _.clone(this.attributes);
		},

		// Proxy `Backbone.sync` by default -- but override this if you need
		// custom syncing semantics for *this* particular model.
		sync: function() {
			return Backbone.sync.apply(this, arguments);
		},

		// Get the value of an attribute.
		get: function(attr) {
			return this.attributes[attr];
		},

		// Get the HTML-escaped value of an attribute.
		escape: function(attr) {
			return _.escape(this.get(attr));
		},

		// Returns `true` if the attribute contains a value that is not null
		// or undefined.
		has: function(attr) {
			return this.get(attr) != null;
		},

		// Set a hash of model attributes on the object, firing `"change"`. This is
		// the core primitive operation of a model, updating the data and notifying
		// anyone who needs to know about the change in state. The heart of the beast.
		set: function(key, val, options) {
			var attr, attrs, unset, changes, silent, changing, prev, current;
			if (key == null) return this;

			// Handle both `"key", value` and `{key: value}` -style arguments.
			if (typeof key === 'object') {
				attrs = key;
				options = val;
			} else {
				(attrs = {})[key] = val;
			}

			options || (options = {});

			// Run validation.
			if (!this._validate(attrs, options)) return false;

			// Extract attributes and options.
			unset = options.unset;
			silent = options.silent;
			changes = [];
			changing = this._changing;
			this._changing = true;

			if (!changing) {
				this._previousAttributes = _.clone(this.attributes);
				this.changed = {};
			}
			current = this.attributes, prev = this._previousAttributes;

			// Check for changes of `id`.
			if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

			// For each `set` attribute, update or delete the current value.
			for (attr in attrs) {
				val = attrs[attr];
				if (!_.isEqual(current[attr], val)) changes.push(attr);
				if (!_.isEqual(prev[attr], val)) {
					this.changed[attr] = val;
				} else {
					delete this.changed[attr];
				}
				unset ? delete current[attr] : current[attr] = val;
			}

			// Trigger all relevant attribute changes.
			if (!silent) {
				if (changes.length) this._pending = options;
				for (var i = 0, l = changes.length; i < l; i++) {
					this.trigger('change:' + changes[i], this, current[changes[i]], options);
				}
			}

			// You might be wondering why there's a `while` loop here. Changes can
			// be recursively nested within `"change"` events.
			if (changing) return this;
			if (!silent) {
				while (this._pending) {
					options = this._pending;
					this._pending = false;
					this.trigger('change', this, options);
				}
			}
			this._pending = false;
			this._changing = false;
			return this;
		},

		// Remove an attribute from the model, firing `"change"`. `unset` is a noop
		// if the attribute doesn't exist.
		unset: function(attr, options) {
			return this.set(attr, void 0, _.extend({}, options, { unset: true }));
		},

		// Clear all attributes on the model, firing `"change"`.
		clear: function(options) {
			var attrs = {};
			for (var key in this.attributes) attrs[key] = void 0;
			return this.set(attrs, _.extend({}, options, { unset: true }));
		},

		// Determine if the model has changed since the last `"change"` event.
		// If you specify an attribute name, determine if that attribute has changed.
		hasChanged: function(attr) {
			if (attr == null) return !_.isEmpty(this.changed);
			return _.has(this.changed, attr);
		},

		// Return an object containing all the attributes that have changed, or
		// false if there are no changed attributes. Useful for determining what
		// parts of a view need to be updated and/or what attributes need to be
		// persisted to the server. Unset attributes will be set to undefined.
		// You can also pass an attributes object to diff against the model,
		// determining if there *would be* a change.
		changedAttributes: function(diff) {
			if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
			var val, changed = false;
			var old = this._changing ? this._previousAttributes : this.attributes;
			for (var attr in diff) {
				if (_.isEqual(old[attr], (val = diff[attr]))) continue;
				(changed || (changed = {}))[attr] = val;
			}
			return changed;
		},

		// Get the previous value of an attribute, recorded at the time the last
		// `"change"` event was fired.
		previous: function(attr) {
			if (attr == null || !this._previousAttributes) return null;
			return this._previousAttributes[attr];
		},

		// Get all of the attributes of the model at the time of the previous
		// `"change"` event.
		previousAttributes: function() {
			return _.clone(this._previousAttributes);
		},

		// Fetch the model from the server. If the server's representation of the
		// model differs from its current attributes, they will be overridden,
		// triggering a `"change"` event.
		fetch: function(options) {
			options = options ? _.clone(options) : {};
			if (options.parse === void 0) options.parse = true;
			var model = this;
			var success = options.success;
			options.success = function(resp) {
				if (!model.set(model.parse(resp, options), options)) return false;
				if (success) success(model, resp, options);
				model.trigger('sync', model, resp, options);
			};
			wrapError(this, options);
			return this.sync('read', this, options);
		},

		// Set a hash of model attributes, and sync the model to the server.
		// If the server returns an attributes hash that differs, the model's
		// state will be `set` again.
		save: function(key, val, options) {
			var attrs, method, xhr, attributes = this.attributes;

			// Handle both `"key", value` and `{key: value}` -style arguments.
			if (key == null || typeof key === 'object') {
				attrs = key;
				options = val;
			} else {
				(attrs = {})[key] = val;
			}

			options = _.extend({ validate: true }, options);

			// If we're not waiting and attributes exist, save acts as
			// `set(attr).save(null, opts)` with validation. Otherwise, check if
			// the model will be valid when the attributes, if any, are set.
			if (attrs && !options.wait) {
				if (!this.set(attrs, options)) return false;
			} else {
				if (!this._validate(attrs, options)) return false;
			}

			// Set temporary attributes if `{wait: true}`.
			if (attrs && options.wait) {
				this.attributes = _.extend({}, attributes, attrs);
			}

			// After a successful server-side save, the client is (optionally)
			// updated with the server-side state.
			if (options.parse === void 0) options.parse = true;
			var model = this;
			var success = options.success;
			options.success = function(resp) {
				// Ensure attributes are restored during synchronous saves.
				model.attributes = attributes;
				var serverAttrs = model.parse(resp, options);
				if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
				if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
					return false;
				}
				if (success) success(model, resp, options);
				model.trigger('sync', model, resp, options);
			};
			wrapError(this, options);

			method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
			if (method === 'patch') options.attrs = attrs;
			xhr = this.sync(method, this, options);

			// Restore attributes.
			if (attrs && options.wait) this.attributes = attributes;

			return xhr;
		},

		// Destroy this model on the server if it was already persisted.
		// Optimistically removes the model from its collection, if it has one.
		// If `wait: true` is passed, waits for the server to respond before removal.
		destroy: function(options) {
			options = options ? _.clone(options) : {};
			var model = this;
			var success = options.success;

			var destroy = function() {
				model.trigger('destroy', model, model.collection, options);
			};

			options.success = function(resp) {
				if (options.wait || model.isNew()) destroy();
				if (success) success(model, resp, options);
				if (!model.isNew()) model.trigger('sync', model, resp, options);
			};

			if (this.isNew()) {
				options.success();
				return false;
			}
			wrapError(this, options);

			var xhr = this.sync('delete', this, options);
			if (!options.wait) destroy();
			return xhr;
		},

		// Default URL for the model's representation on the server -- if you're
		// using Backbone's restful methods, override this to change the endpoint
		// that will be called.
		url: function() {
			var base =
				_.result(this, 'urlRoot') ||
					_.result(this.collection, 'url') ||
					urlError();
			if (this.isNew()) return base;
			return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
		},

		// **parse** converts a response into the hash of attributes to be `set` on
		// the model. The default implementation is just to pass the response along.
		parse: function(resp, options) {
			return resp;
		},

		// Create a new model with identical attributes to this one.
		clone: function() {
			return new this.constructor(this.attributes);
		},

		// A model is new if it has never been saved to the server, and lacks an id.
		isNew: function() {
			return !this.has(this.idAttribute);
		},

		// Check if the model is currently in a valid state.
		isValid: function(options) {
			return this._validate({}, _.extend(options || {}, { validate: true }));
		},

		// Run validation against the next complete set of model attributes,
		// returning `true` if all is well. Otherwise, fire an `"invalid"` event.
		_validate: function(attrs, options) {
			if (!options.validate || !this.validate) return true;
			attrs = _.extend({}, this.attributes, attrs);
			var error = this.validationError = this.validate(attrs, options) || null;
			if (!error) return true;
			this.trigger('invalid', this, error, _.extend(options, { validationError: error }));
			return false;
		}

	});

	// Underscore methods that we want to implement on the Model.
	var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

	// Mix in each Underscore method as a proxy to `Model#attributes`.
	_.each(modelMethods, function(method) {
		Model.prototype[method] = function() {
			var args = slice.call(arguments);
			args.unshift(this.attributes);
			return _[method].apply(_, args);
		};
	});

	// Backbone.Collection
	// -------------------

	// If models tend to represent a single row of data, a Backbone Collection is
	// more analagous to a table full of data ... or a small slice or page of that
	// table, or a collection of rows that belong together for a particular reason
	// -- all of the messages in this particular folder, all of the documents
	// belonging to this particular author, and so on. Collections maintain
	// indexes of their models, both in order, and for lookup by `id`.

	// Create a new **Collection**, perhaps to contain a specific type of `model`.
	// If a `comparator` is specified, the Collection will maintain
	// its models in sort order, as they're added and removed.
	var Collection = Backbone.Collection = function(models, options) {
		options || (options = {});
		if (options.model) this.model = options.model;
		if (options.comparator !== void 0) this.comparator = options.comparator;
		this._reset();
		this.initialize.apply(this, arguments);
		if (models) this.reset(models, _.extend({ silent: true }, options));
	};

	// Default options for `Collection#set`.
	var setOptions = { add: true, remove: true, merge: true };
	var addOptions = { add: true, remove: false };

	// Define the Collection's inheritable methods.
	_.extend(Collection.prototype, Events, {

		// The default model for a collection is just a **Backbone.Model**.
		// This should be overridden in most cases.
		model: Model,

		// Initialize is an empty function by default. Override it with your own
		// initialization logic.
		initialize: function() {},

		// The JSON representation of a Collection is an array of the
		// models' attributes.
		toJSON: function(options) {
			return this.map(function(model) { return model.toJSON(options); });
		},

		// Proxy `Backbone.sync` by default.
		sync: function() {
			return Backbone.sync.apply(this, arguments);
		},

		// Add a model, or list of models to the set.
		add: function(models, options) {
			return this.set(models, _.extend({ merge: false }, options, addOptions));
		},

		// Remove a model, or a list of models from the set.
		remove: function(models, options) {
			var singular = !_.isArray(models);
			models = singular ? [models] : _.clone(models);
			options || (options = {});
			var i, l, index, model;
			for (i = 0, l = models.length; i < l; i++) {
				model = models[i] = this.get(models[i]);
				if (!model) continue;
				delete this._byId[model.id];
				delete this._byId[model.cid];
				index = this.indexOf(model);
				this.models.splice(index, 1);
				this.length--;
				if (!options.silent) {
					options.index = index;
					model.trigger('remove', model, this, options);
				}
				this._removeReference(model, options);
			}
			return singular ? models[0] : models;
		},

		// Update a collection by `set`-ing a new list of models, adding new ones,
		// removing models that are no longer present, and merging models that
		// already exist in the collection, as necessary. Similar to **Model#set**,
		// the core operation for updating the data contained by the collection.
		set: function(models, options) {
			options = _.defaults({}, options, setOptions);
			if (options.parse) models = this.parse(models, options);
			var singular = !_.isArray(models);
			models = singular ? (models ? [models] : []) : _.clone(models);
			var i, l, id, model, attrs, existing, sort;
			var at = options.at;
			var targetModel = this.model;
			var sortable = this.comparator && (at == null) && options.sort !== false;
			var sortAttr = _.isString(this.comparator) ? this.comparator : null;
			var toAdd = [], toRemove = [], modelMap = {};
			var add = options.add, merge = options.merge, remove = options.remove;
			var order = !sortable && add && remove ? [] : false;

			// Turn bare objects into model references, and prevent invalid models
			// from being added.
			for (i = 0, l = models.length; i < l; i++) {
				attrs = models[i] || {};
				if (attrs instanceof Model) {
					id = model = attrs;
				} else {
					id = attrs[targetModel.prototype.idAttribute || 'id'];
				}

				// If a duplicate is found, prevent it from being added and
				// optionally merge it into the existing model.
				if (existing = this.get(id)) {
					if (remove) modelMap[existing.cid] = true;
					if (merge) {
						attrs = attrs === model ? model.attributes : attrs;
						if (options.parse) attrs = existing.parse(attrs, options);
						existing.set(attrs, options);
						if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
					}
					models[i] = existing;

					// If this is a new, valid model, push it to the `toAdd` list.
				} else if (add) {
					model = models[i] = this._prepareModel(attrs, options);
					if (!model) continue;
					toAdd.push(model);
					this._addReference(model, options);
				}

				// Do not add multiple models with the same `id`.
				model = existing || model;
				if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
				modelMap[model.id] = true;
			}

			// Remove nonexistent models if appropriate.
			if (remove) {
				for (i = 0, l = this.length; i < l; ++i) {
					if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
				}
				if (toRemove.length) this.remove(toRemove, options);
			}

			// See if sorting is needed, update `length` and splice in new models.
			if (toAdd.length || (order && order.length)) {
				if (sortable) sort = true;
				this.length += toAdd.length;
				if (at != null) {
					for (i = 0, l = toAdd.length; i < l; i++) {
						this.models.splice(at + i, 0, toAdd[i]);
					}
				} else {
					if (order) this.models.length = 0;
					var orderedModels = order || toAdd;
					for (i = 0, l = orderedModels.length; i < l; i++) {
						this.models.push(orderedModels[i]);
					}
				}
			}

			// Silently sort the collection if appropriate.
			if (sort) this.sort({ silent: true });

			// Unless silenced, it's time to fire all appropriate add/sort events.
			if (!options.silent) {
				for (i = 0, l = toAdd.length; i < l; i++) {
					(model = toAdd[i]).trigger('add', model, this, options);
				}
				if (sort || (order && order.length)) this.trigger('sort', this, options);
			}

			// Return the added (or merged) model (or models).
			return singular ? models[0] : models;
		},

		// When you have more items than you want to add or remove individually,
		// you can reset the entire set with a new list of models, without firing
		// any granular `add` or `remove` events. Fires `reset` when finished.
		// Useful for bulk operations and optimizations.
		reset: function(models, options) {
			options || (options = {});
			for (var i = 0, l = this.models.length; i < l; i++) {
				this._removeReference(this.models[i], options);
			}
			options.previousModels = this.models;
			this._reset();
			models = this.add(models, _.extend({ silent: true }, options));
			if (!options.silent) this.trigger('reset', this, options);
			return models;
		},

		// Add a model to the end of the collection.
		push: function(model, options) {
			return this.add(model, _.extend({ at: this.length }, options));
		},

		// Remove a model from the end of the collection.
		pop: function(options) {
			var model = this.at(this.length - 1);
			this.remove(model, options);
			return model;
		},

		// Add a model to the beginning of the collection.
		unshift: function(model, options) {
			return this.add(model, _.extend({ at: 0 }, options));
		},

		// Remove a model from the beginning of the collection.
		shift: function(options) {
			var model = this.at(0);
			this.remove(model, options);
			return model;
		},

		// Slice out a sub-array of models from the collection.
		slice: function() {
			return slice.apply(this.models, arguments);
		},

		// Get a model from the set by id.
		get: function(obj) {
			if (obj == null) return void 0;
			return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
		},

		// Get the model at the given index.
		at: function(index) {
			return this.models[index];
		},

		// Return models with matching attributes. Useful for simple cases of
		// `filter`.
		where: function(attrs, first) {
			if (_.isEmpty(attrs)) return first ? void 0 : [];
			return this[first ? 'find' : 'filter'](function(model) {
				for (var key in attrs) {
					if (attrs[key] !== model.get(key)) return false;
				}
				return true;
			});
		},

		// Return the first model with matching attributes. Useful for simple cases
		// of `find`.
		findWhere: function(attrs) {
			return this.where(attrs, true);
		},

		// Force the collection to re-sort itself. You don't need to call this under
		// normal circumstances, as the set will maintain sort order as each item
		// is added.
		sort: function(options) {
			if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
			options || (options = {});

			// Run sort based on type of `comparator`.
			if (_.isString(this.comparator) || this.comparator.length === 1) {
				this.models = this.sortBy(this.comparator, this);
			} else {
				this.models.sort(_.bind(this.comparator, this));
			}

			if (!options.silent) this.trigger('sort', this, options);
			return this;
		},

		// Pluck an attribute from each model in the collection.
		pluck: function(attr) {
			return _.invoke(this.models, 'get', attr);
		},

		// Fetch the default set of models for this collection, resetting the
		// collection when they arrive. If `reset: true` is passed, the response
		// data will be passed through the `reset` method instead of `set`.
		fetch: function(options) {
			options = options ? _.clone(options) : {};
			if (options.parse === void 0) options.parse = true;
			var success = options.success;
			var collection = this;
			options.success = function(resp) {
				var method = options.reset ? 'reset' : 'set';
				collection[method](resp, options);
				if (success) success(collection, resp, options);
				collection.trigger('sync', collection, resp, options);
			};
			wrapError(this, options);
			return this.sync('read', this, options);
		},

		// Create a new instance of a model in this collection. Add the model to the
		// collection immediately, unless `wait: true` is passed, in which case we
		// wait for the server to agree.
		create: function(model, options) {
			options = options ? _.clone(options) : {};
			if (!(model = this._prepareModel(model, options))) return false;
			if (!options.wait) this.add(model, options);
			var collection = this;
			var success = options.success;
			options.success = function(model, resp) {
				if (options.wait) collection.add(model, options);
				if (success) success(model, resp, options);
			};
			model.save(null, options);
			return model;
		},

		// **parse** converts a response into a list of models to be added to the
		// collection. The default implementation is just to pass it through.
		parse: function(resp, options) {
			return resp;
		},

		// Create a new collection with an identical list of models as this one.
		clone: function() {
			return new this.constructor(this.models);
		},

		// Private method to reset all internal state. Called when the collection
		// is first initialized or reset.
		_reset: function() {
			this.length = 0;
			this.models = [];
			this._byId = {};
		},

		// Prepare a hash of attributes (or other model) to be added to this
		// collection.
		_prepareModel: function(attrs, options) {
			if (attrs instanceof Model) return attrs;
			options = options ? _.clone(options) : {};
			options.collection = this;
			var model = new this.model(attrs, options);
			if (!model.validationError) return model;
			this.trigger('invalid', this, model.validationError, options);
			return false;
		},

		// Internal method to create a model's ties to a collection.
		_addReference: function(model, options) {
			this._byId[model.cid] = model;
			if (model.id != null) this._byId[model.id] = model;
			if (!model.collection) model.collection = this;
			model.on('all', this._onModelEvent, this);
		},

		// Internal method to sever a model's ties to a collection.
		_removeReference: function(model, options) {
			if (this === model.collection) delete model.collection;
			model.off('all', this._onModelEvent, this);
		},

		// Internal method called every time a model in the set fires an event.
		// Sets need to update their indexes when models change ids. All other
		// events simply proxy through. "add" and "remove" events that originate
		// in other collections are ignored.
		_onModelEvent: function(event, model, collection, options) {
			if ((event === 'add' || event === 'remove') && collection !== this) return;
			if (event === 'destroy') this.remove(model, options);
			if (model && event === 'change:' + model.idAttribute) {
				delete this._byId[model.previous(model.idAttribute)];
				if (model.id != null) this._byId[model.id] = model;
			}
			this.trigger.apply(this, arguments);
		}

	});

	// Underscore methods that we want to implement on the Collection.
	// 90% of the core usefulness of Backbone Collections is actually implemented
	// right here:
	var methods = [
		'forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
		'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
		'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
		'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
		'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
		'lastIndexOf', 'isEmpty', 'chain', 'sample'
	];

	// Mix in each Underscore method as a proxy to `Collection#models`.
	_.each(methods, function(method) {
		Collection.prototype[method] = function() {
			var args = slice.call(arguments);
			args.unshift(this.models);
			return _[method].apply(_, args);
		};
	});

	// Underscore methods that take a property name as an argument.
	var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

	// Use attributes instead of properties.
	_.each(attributeMethods, function(method) {
		Collection.prototype[method] = function(value, context) {
			var iterator = _.isFunction(value) ? value : function(model) {
				return model.get(value);
			};
			return _[method](this.models, iterator, context);
		};
	});

	// Backbone.View
	// -------------

	// Backbone Views are almost more convention than they are actual code. A View
	// is simply a JavaScript object that represents a logical chunk of UI in the
	// DOM. This might be a single item, an entire list, a sidebar or panel, or
	// even the surrounding frame which wraps your whole app. Defining a chunk of
	// UI as a **View** allows you to define your DOM events declaratively, without
	// having to worry about render order ... and makes it easy for the view to
	// react to specific changes in the state of your models.

	// Creating a Backbone.View creates its initial element outside of the DOM,
	// if an existing element is not provided...
	var View = Backbone.View = function(options) {
		this.cid = _.uniqueId('view');
		options || (options = {});
		_.extend(this, _.pick(options, viewOptions));
		this._ensureElement();
		this.initialize.apply(this, arguments);
		this.delegateEvents();
	};

	// Cached regex to split keys for `delegate`.
	var delegateEventSplitter = /^(\S+)\s*(.*)$/;

	// List of view options to be merged as properties.
	var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

	// Set up all inheritable **Backbone.View** properties and methods.
	_.extend(View.prototype, Events, {

		// The default `tagName` of a View's element is `"div"`.
		tagName: 'div',

		// jQuery delegate for element lookup, scoped to DOM elements within the
		// current view. This should be preferred to global lookups where possible.
		$: function(selector) {
			return this.$el.find(selector);
		},

		// Initialize is an empty function by default. Override it with your own
		// initialization logic.
		initialize: function() {},

		// **render** is the core function that your view should override, in order
		// to populate its element (`this.el`), with the appropriate HTML. The
		// convention is for **render** to always return `this`.
		render: function() {
			return this;
		},

		// Remove this view by taking the element out of the DOM, and removing any
		// applicable Backbone.Events listeners.
		remove: function() {
			this.$el.remove();
			this.stopListening();
			return this;
		},

		// Change the view's element (`this.el` property), including event
		// re-delegation.
		setElement: function(element, delegate) {
			if (this.$el) this.undelegateEvents();
			this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
			this.el = this.$el[0];
			if (delegate !== false) this.delegateEvents();
			return this;
		},

		// Set callbacks, where `this.events` is a hash of
		//
		// *{"event selector": "callback"}*
		//
		//     {
		//       'mousedown .title':  'edit',
		//       'click .button':     'save',
		//       'click .open':       function(e) { ... }
		//     }
		//
		// pairs. Callbacks will be bound to the view, with `this` set properly.
		// Uses event delegation for efficiency.
		// Omitting the selector binds the event to `this.el`.
		// This only works for delegate-able events: not `focus`, `blur`, and
		// not `change`, `submit`, and `reset` in Internet Explorer.
		delegateEvents: function(events) {
			if (!(events || (events = _.result(this, 'events')))) return this;
			this.undelegateEvents();
			for (var key in events) {
				var method = events[key];
				if (!_.isFunction(method)) method = this[events[key]];
				if (!method) continue;

				var match = key.match(delegateEventSplitter);
				var eventName = match[1], selector = match[2];
				method = _.bind(method, this);
				eventName += '.delegateEvents' + this.cid;
				if (selector === '') {
					this.$el.on(eventName, method);
				} else {
					this.$el.on(eventName, selector, method);
				}
			}
			return this;
		},

		// Clears all callbacks previously bound to the view with `delegateEvents`.
		// You usually don't need to use this, but may wish to if you have multiple
		// Backbone views attached to the same DOM element.
		undelegateEvents: function() {
			this.$el.off('.delegateEvents' + this.cid);
			return this;
		},

		// Ensure that the View has a DOM element to render into.
		// If `this.el` is a string, pass it through `$()`, take the first
		// matching element, and re-assign it to `el`. Otherwise, create
		// an element from the `id`, `className` and `tagName` properties.
		_ensureElement: function() {
			if (!this.el) {
				var attrs = _.extend({}, _.result(this, 'attributes'));
				if (this.id) attrs.id = _.result(this, 'id');
				if (this.className) attrs['class'] = _.result(this, 'className');
				var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
				this.setElement($el, false);
			} else {
				this.setElement(_.result(this, 'el'), false);
			}
		}

	});

	// Backbone.sync
	// -------------

	// Override this function to change the manner in which Backbone persists
	// models to the server. You will be passed the type of request, and the
	// model in question. By default, makes a RESTful Ajax request
	// to the model's `url()`. Some possible customizations could be:
	//
	// * Use `setTimeout` to batch rapid-fire updates into a single request.
	// * Send up the models as XML instead of JSON.
	// * Persist models via WebSockets instead of Ajax.
	//
	// Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
	// as `POST`, with a `_method` parameter containing the true HTTP method,
	// as well as all requests with the body as `application/x-www-form-urlencoded`
	// instead of `application/json` with the model in a param named `model`.
	// Useful when interfacing with server-side languages like **PHP** that make
	// it difficult to read the body of `PUT` requests.
	Backbone.sync = function(method, model, options) {
		var type = methodMap[method];

		// Default options, unless specified.
		_.defaults(options || (options = {}), {
			emulateHTTP: Backbone.emulateHTTP,
			emulateJSON: Backbone.emulateJSON
		});

		// Default JSON-request options.
		var params = { type: type, dataType: 'json' };

		// Ensure that we have a URL.
		if (!options.url) {
			params.url = _.result(model, 'url') || urlError();
		}

		// Ensure that we have the appropriate request data.
		if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
			params.contentType = 'application/json';
			params.data = JSON.stringify(options.attrs || model.toJSON(options));
		}

		// For older servers, emulate JSON by encoding the request into an HTML-form.
		if (options.emulateJSON) {
			params.contentType = 'application/x-www-form-urlencoded';
			params.data = params.data ? { model: params.data } : {};
		}

		// For older servers, emulate HTTP by mimicking the HTTP method with `_method`
		// And an `X-HTTP-Method-Override` header.
		if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
			params.type = 'POST';
			if (options.emulateJSON) params.data._method = type;
			var beforeSend = options.beforeSend;
			options.beforeSend = function(xhr) {
				xhr.setRequestHeader('X-HTTP-Method-Override', type);
				if (beforeSend) return beforeSend.apply(this, arguments);
			};
		}

		// Don't process data on a non-GET request.
		if (params.type !== 'GET' && !options.emulateJSON) {
			params.processData = false;
		}

		// If we're sending a `PATCH` request, and we're in an old Internet Explorer
		// that still has ActiveX enabled by default, override jQuery to use that
		// for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
		if (params.type === 'PATCH' && noXhrPatch) {
			params.xhr = function() {
				return new ActiveXObject("Microsoft.XMLHTTP");
			};
		}

		// Make the request, allowing the user to override any Ajax options.
		var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
		model.trigger('request', model, xhr, options);
		return xhr;
	};

	var noXhrPatch =
		typeof window !== 'undefined' && !!window.ActiveXObject &&
			!(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

	// Map from CRUD to HTTP for our default `Backbone.sync` implementation.
	var methodMap = {
		'create': 'POST',
		'update': 'PUT',
		'patch': 'PATCH',
		'delete': 'DELETE',
		'read': 'GET'
	};

	// Set the default implementation of `Backbone.ajax` to proxy through to `$`.
	// Override this if you'd like to use a different library.
	Backbone.ajax = function() {
		return Backbone.$.ajax.apply(Backbone.$, arguments);
	};

	// Backbone.Router
	// ---------------

	// Routers map faux-URLs to actions, and fire events when routes are
	// matched. Creating a new one sets its `routes` hash, if not set statically.
	var Router = Backbone.Router = function(options) {
		options || (options = {});
		if (options.routes) this.routes = options.routes;
		this._bindRoutes();
		this.initialize.apply(this, arguments);
	};

	// Cached regular expressions for matching named param parts and splatted
	// parts of route strings.
	var optionalParam = /\((.*?)\)/g;
	var namedParam = /(\(\?)?:\w+/g;
	var splatParam = /\*\w+/g;
	var escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;

	// Set up all inheritable **Backbone.Router** properties and methods.
	_.extend(Router.prototype, Events, {

		// Initialize is an empty function by default. Override it with your own
		// initialization logic.
		initialize: function() {},

		// Manually bind a single named route to a callback. For example:
		//
		//     this.route('search/:query/p:num', 'search', function(query, num) {
		//       ...
		//     });
		//
		route: function(route, name, callback) {
			if (!_.isRegExp(route)) route = this._routeToRegExp(route);
			if (_.isFunction(name)) {
				callback = name;
				name = '';
			}
			if (!callback) callback = this[name];
			var router = this;
			Backbone.history.route(route, function(fragment) {
				var args = router._extractParameters(route, fragment);
				router.execute(callback, args);
				router.trigger.apply(router, ['route:' + name].concat(args));
				router.trigger('route', name, args);
				Backbone.history.trigger('route', router, name, args);
			});
			return this;
		},

		// Execute a route handler with the provided parameters.  This is an
		// excellent place to do pre-route setup or post-route cleanup.
		execute: function(callback, args) {
			if (callback) callback.apply(this, args);
		},

		// Simple proxy to `Backbone.history` to save a fragment into the history.
		navigate: function(fragment, options) {
			Backbone.history.navigate(fragment, options);
			return this;
		},

		// Bind all defined routes to `Backbone.history`. We have to reverse the
		// order of the routes here to support behavior where the most general
		// routes can be defined at the bottom of the route map.
		_bindRoutes: function() {
			if (!this.routes) return;
			this.routes = _.result(this, 'routes');
			var route, routes = _.keys(this.routes);
			while ((route = routes.pop()) != null) {
				this.route(route, this.routes[route]);
			}
		},

		// Convert a route string into a regular expression, suitable for matching
		// against the current location hash.
		_routeToRegExp: function(route) {
			route = route.replace(escapeRegExp, '\\$&')
				.replace(optionalParam, '(?:$1)?')
				.replace(namedParam, function(match, optional) {
					return optional ? match : '([^/?]+)';
				})
				.replace(splatParam, '([^?]*?)');
			return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
		},

		// Given a route, and a URL fragment that it matches, return the array of
		// extracted decoded parameters. Empty or unmatched parameters will be
		// treated as `null` to normalize cross-browser behavior.
		_extractParameters: function(route, fragment) {
			var params = route.exec(fragment).slice(1);
			return _.map(params, function(param, i) {
				// Don't decode the search params.
				if (i === params.length - 1) return param || null;
				return param ? decodeURIComponent(param) : null;
			});
		}

	});

	// Backbone.History
	// ----------------

	// Handles cross-browser history management, based on either
	// [pushState](http://diveintohtml5.info/history.html) and real URLs, or
	// [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
	// and URL fragments. If the browser supports neither (old IE, natch),
	// falls back to polling.
	var History = Backbone.History = function() {
		this.handlers = [];
		_.bindAll(this, 'checkUrl');

		// Ensure that `History` can be used outside of the browser.
		if (typeof window !== 'undefined') {
			this.location = window.location;
			this.history = window.history;
		}
	};

	// Cached regex for stripping a leading hash/slash and trailing space.
	var routeStripper = /^[#\/]|\s+$/g;

	// Cached regex for stripping leading and trailing slashes.
	var rootStripper = /^\/+|\/+$/g;

	// Cached regex for detecting MSIE.
	var isExplorer = /msie [\w.]+/;

	// Cached regex for removing a trailing slash.
	var trailingSlash = /\/$/;

	// Cached regex for stripping urls of hash.
	var pathStripper = /#.*$/;

	// Has the history handling already been started?
	History.started = false;

	// Set up all inheritable **Backbone.History** properties and methods.
	_.extend(History.prototype, Events, {

		// The default interval to poll for hash changes, if necessary, is
		// twenty times a second.
		interval: 50,

		// Are we at the app root?
		atRoot: function() {
			return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
		},

		// Gets the true hash value. Cannot use location.hash directly due to bug
		// in Firefox where location.hash will always be decoded.
		getHash: function(window) {
			var match = (window || this).location.href.match(/#(.*)$/);
			return match ? match[1] : '';
		},

		// Get the cross-browser normalized URL fragment, either from the URL,
		// the hash, or the override.
		getFragment: function(fragment, forcePushState) {
			if (fragment == null) {
				if (this._hasPushState || !this._wantsHashChange || forcePushState) {
					fragment = decodeURI(this.location.pathname + this.location.search);
					var root = this.root.replace(trailingSlash, '');
					if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
				} else {
					fragment = this.getHash();
				}
			}
			return fragment.replace(routeStripper, '');
		},

		// Start the hash change handling, returning `true` if the current URL matches
		// an existing route, and `false` otherwise.
		start: function(options) {
			if (History.started) throw new Error("Backbone.history has already been started");
			History.started = true;

			// Figure out the initial configuration. Do we need an iframe?
			// Is pushState desired ... is it available?
			this.options = _.extend({ root: '/' }, this.options, options);
			this.root = this.options.root;
			this._wantsHashChange = this.options.hashChange !== false;
			this._wantsPushState = !!this.options.pushState;
			this._hasPushState = !!(this.options.pushState && this.history && this.history.pushState);
			var fragment = this.getFragment();
			var docMode = document.documentMode;
			var oldIE = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

			// Normalize root to always include a leading and trailing slash.
			this.root = ('/' + this.root + '/').replace(rootStripper, '/');

			if (oldIE && this._wantsHashChange) {
				var frame = Backbone.$('<iframe src="javascript:0" tabindex="-1">');
				this.iframe = frame.hide().appendTo('body')[0].contentWindow;
				this.navigate(fragment);
			}

			// Depending on whether we're using pushState or hashes, and whether
			// 'onhashchange' is supported, determine how we check the URL state.
			if (this._hasPushState) {
				Backbone.$(window).on('popstate', this.checkUrl);
			} else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
				Backbone.$(window).on('hashchange', this.checkUrl);
			} else if (this._wantsHashChange) {
				this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
			}

			// Determine if we need to change the base url, for a pushState link
			// opened by a non-pushState browser.
			this.fragment = fragment;
			var loc = this.location;

			// Transition from hashChange to pushState or vice versa if both are
			// requested.
			if (this._wantsHashChange && this._wantsPushState) {

				// If we've started off with a route from a `pushState`-enabled
				// browser, but we're currently in a browser that doesn't support it...
				if (!this._hasPushState && !this.atRoot()) {
					this.fragment = this.getFragment(null, true);
					this.location.replace(this.root + '#' + this.fragment);
					// Return immediately as browser will do redirect to new url
					return true;

					// Or if we've started out with a hash-based route, but we're currently
					// in a browser where it could be `pushState`-based instead...
				} else if (this._hasPushState && this.atRoot() && loc.hash) {
					this.fragment = this.getHash().replace(routeStripper, '');
					this.history.replaceState({}, document.title, this.root + this.fragment);
				}

			}

			if (!this.options.silent) return this.loadUrl();
		},

		// Disable Backbone.history, perhaps temporarily. Not useful in a real app,
		// but possibly useful for unit testing Routers.
		stop: function() {
			Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
			if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
			History.started = false;
		},

		// Add a route to be tested when the fragment changes. Routes added later
		// may override previous routes.
		route: function(route, callback) {
			this.handlers.unshift({ route: route, callback: callback });
		},

		// Checks the current URL to see if it has changed, and if it has,
		// calls `loadUrl`, normalizing across the hidden iframe.
		checkUrl: function(e) {
			var current = this.getFragment();
			if (current === this.fragment && this.iframe) {
				current = this.getFragment(this.getHash(this.iframe));
			}
			if (current === this.fragment) return false;
			if (this.iframe) this.navigate(current);
			this.loadUrl();
		},

		// Attempt to load the current URL fragment. If a route succeeds with a
		// match, returns `true`. If no defined routes matches the fragment,
		// returns `false`.
		loadUrl: function(fragment) {
			fragment = this.fragment = this.getFragment(fragment);
			return _.any(this.handlers, function(handler) {
				if (handler.route.test(fragment)) {
					handler.callback(fragment);
					return true;
				}
			});
		},

		// Save a fragment into the hash history, or replace the URL state if the
		// 'replace' option is passed. You are responsible for properly URL-encoding
		// the fragment in advance.
		//
		// The options object can contain `trigger: true` if you wish to have the
		// route callback be fired (not usually desirable), or `replace: true`, if
		// you wish to modify the current URL without adding an entry to the history.
		navigate: function(fragment, options) {
			if (!History.started) return false;
			if (!options || options === true) options = { trigger: !!options };

			var url = this.root + (fragment = this.getFragment(fragment || ''));

			// Strip the hash for matching.
			fragment = fragment.replace(pathStripper, '');

			if (this.fragment === fragment) return;
			this.fragment = fragment;

			// Don't include a trailing slash on the root.
			if (fragment === '' && url !== '/') url = url.slice(0, -1);

			// If pushState is available, we use it to set the fragment as a real URL.
			if (this._hasPushState) {
				this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

				// If hash changes haven't been explicitly disabled, update the hash
				// fragment to store history.
			} else if (this._wantsHashChange) {
				this._updateHash(this.location, fragment, options.replace);
				if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
					// Opening and closing the iframe tricks IE7 and earlier to push a
					// history entry on hash-tag change.  When replace is true, we don't
					// want this.
					if (!options.replace) this.iframe.document.open().close();
					this._updateHash(this.iframe.location, fragment, options.replace);
				}

				// If you've told us that you explicitly don't want fallback hashchange-
				// based history, then `navigate` becomes a page refresh.
			} else {
				return this.location.assign(url);
			}
			if (options.trigger) return this.loadUrl(fragment);
		},

		// Update the hash location, either replacing the current entry, or adding
		// a new one to the browser history.
		_updateHash: function(location, fragment, replace) {
			if (replace) {
				var href = location.href.replace(/(javascript:|#).*$/, '');
				location.replace(href + '#' + fragment);
			} else {
				// Some browsers require that `hash` contains a leading #.
				location.hash = '#' + fragment;
			}
		}

	});

	// Create the default Backbone.history.
	Backbone.history = new History;

	// Helpers
	// -------

	// Helper function to correctly set up the prototype chain, for subclasses.
	// Similar to `goog.inherits`, but uses a hash of prototype properties and
	// class properties to be extended.
	var extend = function(protoProps, staticProps) {
		var parent = this;
		var child;

		// The constructor function for the new subclass is either defined by you
		// (the "constructor" property in your `extend` definition), or defaulted
		// by us to simply call the parent's constructor.
		if (protoProps && _.has(protoProps, 'constructor')) {
			child = protoProps.constructor;
		} else {
			child = function() { return parent.apply(this, arguments); };
		}

		// Add static properties to the constructor function, if supplied.
		_.extend(child, parent, staticProps);

		// Set the prototype chain to inherit from `parent`, without calling
		// `parent`'s constructor function.
		var Surrogate = function() { this.constructor = child; };
		Surrogate.prototype = parent.prototype;
		child.prototype = new Surrogate;

		// Add prototype properties (instance properties) to the subclass,
		// if supplied.
		if (protoProps) _.extend(child.prototype, protoProps);

		// Set a convenience property in case the parent's prototype is needed
		// later.
		child.__super__ = parent.prototype;

		return child;
	};

	// Set up inheritance for the model, collection, router, view and history.
	Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

	// Throw an error when a URL is needed, and none is supplied.
	var urlError = function() {
		throw new Error('A "url" property or function must be specified');
	};

	// Wrap an optional error callback with a fallback error event.
	var wrapError = function(model, options) {
		var error = options.error;
		options.error = function(resp) {
			if (error) error(model, resp, options);
			model.trigger('error', model, resp, options);
		};
	};

	return Backbone;

}));
//Override the default jquery object that is pulled from 
//the window
// PLEASE NOTE: This needs to be upgraded to using Underscore, backbone, and marionette's noConflict() modes so we don't break people's apps!
if (window.$pureChatJquery) {
	Backbone.$ = window.$pureChatJquery;
	//Marionette.$ = window.$pureChatJquery;
}
/* vim: set tabstop=4 softtabstop=4 shiftwidth=4 noexpandtab: */
/**
 * Backbone-relational.js 0.9.0
 * (c) 2011-2014 Paul Uithol and contributors (https://github.com/PaulUithol/Backbone-relational/graphs/contributors)
 *
 * Backbone-relational may be freely distributed under the MIT license; see the accompanying LICENSE.txt.
 * For details and documentation: https://github.com/PaulUithol/Backbone-relational.
 * Depends on Backbone (and thus on Underscore as well): https://github.com/documentcloud/backbone.
 *
 * Example:
 *
	Zoo = Backbone.RelationalModel.extend({
		relations: [ {
			type: Backbone.HasMany,
			key: 'animals',
			relatedModel: 'Animal',
			reverseRelation: {
				key: 'livesIn',
				includeInJSON: 'id'
				// 'relatedModel' is automatically set to 'Zoo'; the 'relationType' to 'HasOne'.
			}
		} ],

		toString: function() {
			return this.get( 'name' );
		}
	});

	Animal = Backbone.RelationalModel.extend({
		toString: function() {
			return this.get( 'species' );
		}
	});

	// Creating the zoo will give it a collection with one animal in it: the monkey.
	// The animal created after that has a relation `livesIn` that points to the zoo it's currently associated with.
	// If you instantiate (or fetch) the zebra later, it will automatically be added.

	var zoo = new Zoo({
		name: 'Artis',
		animals: [ { id: 'monkey-1', species: 'Chimp' }, 'lion-1', 'zebra-1' ]
	});

	var lion = new Animal( { id: 'lion-1', species: 'Lion' } ),
		monkey = zoo.get( 'animals' ).first(),
		sameZoo = lion.get( 'livesIn' );
 */
(function(root, factory) {
	// Set up Backbone-relational for the environment. Start with AMD.
	//if (typeof define === 'function' && define.amd) {
	//    define(['exports', 'backbone', 'underscore'], factory);
	//}
	//    // Next for Node.js or CommonJS.
	//else if (typeof exports !== 'undefined') {
	//    factory(exports, require('backbone'), require('underscore'));
	//}
	//    // Finally, as a browser global. Use `root` here as it references `window`.
	//else {
	factory(root, root.Backbone, root._);
	//}
}(this, function(exports, Backbone, _) {
	"use strict";

	Backbone.Relational = {
		showWarnings: true
	};

	/**
	   * Semaphore mixin; can be used as both binary and counting.
	   **/
	Backbone.Semaphore = {
		_permitsAvailable: null,
		_permitsUsed: 0,

		acquire: function() {
			if (this._permitsAvailable && this._permitsUsed >= this._permitsAvailable) {
				throw new Error('Max permits acquired');
			} else {
				this._permitsUsed++;
			}
		},

		release: function() {
			if (this._permitsUsed === 0) {
				throw new Error('All permits released');
			} else {
				this._permitsUsed--;
			}
		},

		isLocked: function() {
			return this._permitsUsed > 0;
		},

		setAvailablePermits: function(amount) {
			if (this._permitsUsed > amount) {
				throw new Error('Available permits cannot be less than used permits');
			}
			this._permitsAvailable = amount;
		}
	};

	/**
	   * A BlockingQueue that accumulates items while blocked (via 'block'),
	   * and processes them when unblocked (via 'unblock').
	   * Process can also be called manually (via 'process').
	   */
	Backbone.BlockingQueue = function() {
		this._queue = [];
	};
	_.extend(Backbone.BlockingQueue.prototype, Backbone.Semaphore, {
		_queue: null,

		add: function(func) {
			if (this.isBlocked()) {
				this._queue.push(func);
			} else {
				func();
			}
		},

		// Some of the queued events may trigger other blocking events. By
		// copying the queue here it allows queued events to process closer to
		// the natural order.
		//
		// queue events [ 'A', 'B', 'C' ]
		// A handler of 'B' triggers 'D' and 'E'
		// By copying `this._queue` this executes:
		// [ 'A', 'B', 'D', 'E', 'C' ]
		// The same order the would have executed if they didn't have to be
		// delayed and queued.
		process: function() {
			var queue = this._queue;
			this._queue = [];
			while (queue && queue.length) {
				queue.shift()();
			}
		},

		block: function() {
			this.acquire();
		},

		unblock: function() {
			this.release();
			if (!this.isBlocked()) {
				this.process();
			}
		},

		isBlocked: function() {
			return this.isLocked();
		}
	});
	/**
	   * Global event queue. Accumulates external events ('add:<key>', 'remove:<key>' and 'change:<key>')
	   * until the top-level object is fully initialized (see 'Backbone.RelationalModel').
	   */
	Backbone.Relational.eventQueue = new Backbone.BlockingQueue();

	/**
	   * Backbone.Store keeps track of all created (and destruction of) Backbone.RelationalModel.
	   * Handles lookup for relations.
	   */
	Backbone.Store = function() {
		this._collections = [];
		this._reverseRelations = [];
		this._orphanRelations = [];
		this._subModels = [];
		this._modelScopes = [exports];
	};
	_.extend(Backbone.Store.prototype, Backbone.Events, {
		/**
		   * Create a new `Relation`.
		   * @param {Backbone.RelationalModel} [model]
		   * @param {Object} relation
		   * @param {Object} [options]
		   */
		initializeRelation: function(model, relation, options) {
			var type = !_.isString(relation.type) ? relation.type : Backbone[relation.type] || this.getObjectByName(relation.type);
			if (type && type.prototype instanceof Backbone.Relation) {
				var rel = new type(model, relation, options); // Also pushes the new Relation into `model._relations`
			} else {
				Backbone.Relational.showWarnings && typeof console !== 'undefined' && console.warn('Relation=%o; missing or invalid relation type!', relation);
			}
		},

		/**
		   * Add a scope for `getObjectByName` to look for model types by name.
		   * @param {Object} scope
		   */
		addModelScope: function(scope) {
			this._modelScopes.push(scope);
		},

		/**
		   * Remove a scope.
		   * @param {Object} scope
		   */
		removeModelScope: function(scope) {
			this._modelScopes = _.without(this._modelScopes, scope);
		},

		/**
		   * Add a set of subModelTypes to the store, that can be used to resolve the '_superModel'
		   * for a model later in 'setupSuperModel'.
		   *
		   * @param {Backbone.RelationalModel} subModelTypes
		   * @param {Backbone.RelationalModel} superModelType
		   */
		addSubModels: function(subModelTypes, superModelType) {
			this._subModels.push({
				'superModelType': superModelType,
				'subModels': subModelTypes
			});
		},

		/**
		   * Check if the given modelType is registered as another model's subModel. If so, add it to the super model's
		   * '_subModels', and set the modelType's '_superModel', '_subModelTypeName', and '_subModelTypeAttribute'.
		   *
		   * @param {Backbone.RelationalModel} modelType
		   */
		setupSuperModel: function(modelType) {
			_.find(this._subModels, function(subModelDef) {
				return _.filter(subModelDef.subModels || [], function(subModelTypeName, typeValue) {
					var subModelType = this.getObjectByName(subModelTypeName);

					if (modelType === subModelType) {
						// Set 'modelType' as a child of the found superModel
						subModelDef.superModelType._subModels[typeValue] = modelType;

						// Set '_superModel', '_subModelTypeValue', and '_subModelTypeAttribute' on 'modelType'.
						modelType._superModel = subModelDef.superModelType;
						modelType._subModelTypeValue = typeValue;
						modelType._subModelTypeAttribute = subModelDef.superModelType.prototype.subModelTypeAttribute;
						return true;
					}
				}, this).length;
			}, this);
		},

		/**
		   * Add a reverse relation. Is added to the 'relations' property on model's prototype, and to
		   * existing instances of 'model' in the store as well.
		   * @param {Object} relation
		   * @param {Backbone.RelationalModel} relation.model
		   * @param {String} relation.type
		   * @param {String} relation.key
		   * @param {String|Object} relation.relatedModel
		   */
		addReverseRelation: function(relation) {
			var exists = _.any(this._reverseRelations, function(rel) {
				return _.all(relation || [], function(val, key) {
					return val === rel[key];
				});
			});

			if (!exists && relation.model && relation.type) {
				this._reverseRelations.push(relation);
				this._addRelation(relation.model, relation);
				this.retroFitRelation(relation);
			}
		},

		/**
		   * Deposit a `relation` for which the `relatedModel` can't be resolved at the moment.
		   *
		   * @param {Object} relation
		   */
		addOrphanRelation: function(relation) {
			var exists = _.any(this._orphanRelations, function(rel) {
				return _.all(relation || [], function(val, key) {
					return val === rel[key];
				});
			});

			if (!exists && relation.model && relation.type) {
				this._orphanRelations.push(relation);
			}
		},

		/**
		   * Try to initialize any `_orphanRelation`s
		   */
		processOrphanRelations: function() {
			// Make sure to operate on a copy since we're removing while iterating
			_.each(this._orphanRelations.slice(0), function(rel) {
				var relatedModel = Backbone.Relational.store.getObjectByName(rel.relatedModel);
				if (relatedModel) {
					this.initializeRelation(null, rel);
					this._orphanRelations = _.without(this._orphanRelations, rel);
				}
			}, this);
		},

		/**
		   *
		   * @param {Backbone.RelationalModel.constructor} type
		   * @param {Object} relation
		   * @private
		   */
		_addRelation: function(type, relation) {
			if (!type.prototype.relations) {
				type.prototype.relations = [];
			}
			type.prototype.relations.push(relation);

			_.each(type._subModels || [], function(subModel) {
				this._addRelation(subModel, relation);
			}, this);
		},

		/**
		   * Add a 'relation' to all existing instances of 'relation.model' in the store
		   * @param {Object} relation
		   */
		retroFitRelation: function(relation) {
			var coll = this.getCollection(relation.model, false);
			coll && coll.each(function(model) {
				if (!(model instanceof relation.model)) {
					return;
				}

				var rel = new relation.type(model, relation);
			}, this);
		},

		/**
		   * Find the Store's collection for a certain type of model.
		   * @param {Backbone.RelationalModel} type
		   * @param {Boolean} [create=true] Should a collection be created if none is found?
		   * @return {Backbone.Collection} A collection if found (or applicable for 'model'), or null
		   */
		getCollection: function(type, create) {
			if (type instanceof Backbone.RelationalModel) {
				type = type.constructor;
			}

			var rootModel = type;
			while (rootModel._superModel) {
				rootModel = rootModel._superModel;
			}

			var coll = _.find(this._collections, function(item) {
				return item.model === rootModel;
			});

			if (!coll && create !== false) {
				coll = this._createCollection(rootModel);
			}

			return coll;
		},

		/**
		   * Find a model type on one of the modelScopes by name. Names are split on dots.
		   * @param {String} name
		   * @return {Object}
		   */
		getObjectByName: function(name) {
			var parts = name.split('.'),
				type = null;

			_.find(this._modelScopes, function(scope) {
				type = _.reduce(parts || [], function(memo, val) {
					return memo ? memo[val] : undefined;
				}, scope);

				if (type && type !== scope) {
					return true;
				}
			}, this);

			return type;
		},

		_createCollection: function(type) {
			var coll;

			// If 'type' is an instance, take its constructor
			if (type instanceof Backbone.RelationalModel) {
				type = type.constructor;
			}

			// Type should inherit from Backbone.RelationalModel.
			if (type.prototype instanceof Backbone.RelationalModel) {
				coll = new Backbone.Collection();
				coll.model = type;

				this._collections.push(coll);
			}

			return coll;
		},

		/**
		   * Find the attribute that is to be used as the `id` on a given object
		   * @param type
		   * @param {String|Number|Object|Backbone.RelationalModel} item
		   * @return {String|Number}
		   */
		resolveIdForItem: function(type, item) {
			var id = _.isString(item) || _.isNumber(item) ? item : null;

			if (id === null) {
				if (item instanceof Backbone.RelationalModel) {
					id = item.id;
				} else if (_.isObject(item)) {
					id = item[type.prototype.idAttribute];
				}
			}

			// Make all falsy values `null` (except for 0, which could be an id.. see '/issues/179')
			if (!id && id !== 0) {
				id = null;
			}

			return id;
		},

		/**
		   * Find a specific model of a certain `type` in the store
		   * @param type
		   * @param {String|Number|Object|Backbone.RelationalModel} item
		   */
		find: function(type, item) {
			var id = this.resolveIdForItem(type, item),
				coll = this.getCollection(type);

			// Because the found object could be of any of the type's superModel
			// types, only return it if it's actually of the type asked for.
			if (coll) {
				var obj = coll.get(id);

				if (obj instanceof type) {
					return obj;
				}
			}

			return null;
		},

		/**
		   * Add a 'model' to its appropriate collection. Retain the original contents of 'model.collection'.
		   * @param {Backbone.RelationalModel} model
		   */
		register: function(model) {
			var coll = this.getCollection(model);

			if (coll) {
				var modelColl = model.collection;
				coll.add(model);
				model.collection = modelColl;
			}
		},

		/**
		   * Check if the given model may use the given `id`
		   * @param model
		   * @param [id]
		   */
		checkId: function(model, id) {
			var coll = this.getCollection(model),
				duplicate = coll && coll.get(id);

			if (duplicate && model !== duplicate) {
				if (Backbone.Relational.showWarnings && typeof console !== 'undefined') {
					console.warn('Duplicate id! Old RelationalModel=%o, new RelationalModel=%o', duplicate, model);
				}

				throw new Error("Cannot instantiate more than one Backbone.RelationalModel with the same id per type!");
			}
		},

		/**
		   * Explicitly update a model's id in its store collection
		   * @param {Backbone.RelationalModel} model
		   */
		update: function(model) {
			var coll = this.getCollection(model);

			// Register a model if it isn't yet (which happens if it was created without an id).
			if (!coll.contains(model)) {
				this.register(model);
			}

			// This triggers updating the lookup indices kept in a collection
			coll._onModelEvent('change:' + model.idAttribute, model, coll);

			// Trigger an event on model so related models (having the model's new id in their keyContents) can add it.
			model.trigger('relational:change:id', model, coll);
		},

		/**
		   * Unregister from the store: a specific model, a collection, or a model type.
		   * @param {Backbone.RelationalModel|Backbone.RelationalModel.constructor|Backbone.Collection} type
		   */
		unregister: function(type) {
			var coll,
				models;

			if (type instanceof Backbone.Model) {
				coll = this.getCollection(type);
				models = [type];
			} else if (type instanceof Backbone.Collection) {
				coll = this.getCollection(type.model);
				models = _.clone(type.models);
			} else {
				coll = this.getCollection(type);
				models = _.clone(coll.models);
			}

			_.each(models, function(model) {
				this.stopListening(model);
				_.invoke(model.getRelations(), 'stopListening');
			}, this);


			// If we've unregistered an entire store collection, reset the collection (which is much faster).
			// Otherwise, remove each model one by one.
			if (_.contains(this._collections, type)) {
				coll.reset([]);
			} else {
				_.each(models, function(model) {
					if (coll.get(model)) {
						coll.remove(model);
					} else {
						coll.trigger('relational:remove', model, coll);
					}
				}, this);
			}
		},

		/**
		   * Reset the `store` to it's original state. The `reverseRelations` are kept though, since attempting to
		   * re-initialize these on models would lead to a large amount of warnings.
		   */
		reset: function() {
			this.stopListening();

			// Unregister each collection to remove event listeners
			_.each(this._collections, function(coll) {
				this.unregister(coll);
			}, this);

			this._collections = [];
			this._subModels = [];
			this._modelScopes = [exports];
		}
	});
	Backbone.Relational.store = new Backbone.Store();

	/**
	   * The main Relation class, from which 'HasOne' and 'HasMany' inherit. Internally, 'relational:<key>' events
	   * are used to regulate addition and removal of models from relations.
	   *
	   * @param {Backbone.RelationalModel} [instance] Model that this relation is created for. If no model is supplied,
	   *      Relation just tries to instantiate it's `reverseRelation` if specified, and bails out after that.
	   * @param {Object} options
	   * @param {string} options.key
	   * @param {Backbone.RelationalModel.constructor} options.relatedModel
	   * @param {Boolean|String} [options.includeInJSON=true] Serialize the given attribute for related model(s)' in toJSON, or just their ids.
	   * @param {Boolean} [options.createModels=true] Create objects from the contents of keys if the object is not found in Backbone.store.
	   * @param {Object} [options.reverseRelation] Specify a bi-directional relation. If provided, Relation will reciprocate
	   *    the relation to the 'relatedModel'. Required and optional properties match 'options', except that it also needs
	   *    {Backbone.Relation|String} type ('HasOne' or 'HasMany').
	   * @param {Object} opts
	   */
	Backbone.Relation = function(instance, options, opts) {
		this.instance = instance;
		// Make sure 'options' is sane, and fill with defaults from subclasses and this object's prototype
		options = _.isObject(options) ? options : {};
		this.reverseRelation = _.defaults(options.reverseRelation || {}, this.options.reverseRelation);
		this.options = _.defaults(options, this.options, Backbone.Relation.prototype.options);

		this.reverseRelation.type = !_.isString(this.reverseRelation.type) ? this.reverseRelation.type :
			Backbone[this.reverseRelation.type] || Backbone.Relational.store.getObjectByName(this.reverseRelation.type);

		this.key = this.options.key;
		this.keySource = this.options.keySource || this.key;
		this.keyDestination = this.options.keyDestination || this.keySource || this.key;

		this.model = this.options.model || this.instance.constructor;

		this.relatedModel = this.options.relatedModel;

		// No 'relatedModel' is interpreted as self-referential
		if (_.isUndefined(this.relatedModel)) {
			this.relatedModel = this.model;
		}

		// Otherwise, try to resolve the given value to an object
		if (_.isFunction(this.relatedModel) && !(this.relatedModel.prototype instanceof Backbone.RelationalModel)) {
			this.relatedModel = _.result(this, 'relatedModel');
		}
		if (_.isString(this.relatedModel)) {
			this.relatedModel = Backbone.Relational.store.getObjectByName(this.relatedModel);
		}


		if (!this.checkPreconditions()) {
			return;
		}

		// Add the reverse relation on 'relatedModel' to the store's reverseRelations
		if (!this.options.isAutoRelation && this.reverseRelation.type && this.reverseRelation.key) {
			Backbone.Relational.store.addReverseRelation(_.defaults({
					isAutoRelation: true,
					model: this.relatedModel,
					relatedModel: this.model,
					reverseRelation: this.options // current relation is the 'reverseRelation' for its own reverseRelation
				},
				this.reverseRelation // Take further properties from this.reverseRelation (type, key, etc.)
			));
		}

		if (instance) {
			var contentKey = this.keySource;
			if (contentKey !== this.key && _.isObject(this.instance.get(this.key))) {
				contentKey = this.key;
			}

			this.setKeyContents(this.instance.get(contentKey));
			this.relatedCollection = Backbone.Relational.store.getCollection(this.relatedModel);

			// Explicitly clear 'keySource', to prevent a leaky abstraction if 'keySource' differs from 'key'.
			if (this.keySource !== this.key) {
				delete this.instance.attributes[this.keySource];
			}

			// Add this Relation to instance._relations
			this.instance._relations[this.key] = this;

			this.initialize(opts);

			if (this.options.autoFetch) {
				this.instance.getAsync(this.key, _.isObject(this.options.autoFetch) ? this.options.autoFetch : {});
			}

			// When 'relatedModel' are created or destroyed, check if it affects this relation.
			this.listenTo(this.instance, 'destroy', this.destroy)
				.listenTo(this.relatedCollection, 'relational:add relational:change:id', this.tryAddRelated)
				.listenTo(this.relatedCollection, 'relational:remove', this.removeRelated);
		}
	};
	// Fix inheritance :\
	Backbone.Relation.extend = Backbone.Model.extend;
	// Set up all inheritable **Backbone.Relation** properties and methods.
	_.extend(Backbone.Relation.prototype, Backbone.Events, Backbone.Semaphore, {
		options: {
			createModels: true,
			includeInJSON: true,
			isAutoRelation: false,
			autoFetch: false,
			parse: false
		},

		instance: null,
		key: null,
		keyContents: null,
		relatedModel: null,
		relatedCollection: null,
		reverseRelation: null,
		related: null,

		/**
		   * Check several pre-conditions.
		   * @return {Boolean} True if pre-conditions are satisfied, false if they're not.
		   */
		checkPreconditions: function() {
			var i = this.instance,
				k = this.key,
				m = this.model,
				rm = this.relatedModel,
				warn = Backbone.Relational.showWarnings && typeof console !== 'undefined';

			if (!m || !k || !rm) {
				warn && console.warn('Relation=%o: missing model, key or relatedModel (%o, %o, %o).', this, m, k, rm);
				return false;
			}
			// Check if the type in 'model' inherits from Backbone.RelationalModel
			if (!(m.prototype instanceof Backbone.RelationalModel)) {
				warn && console.warn('Relation=%o: model does not inherit from Backbone.RelationalModel (%o).', this, i);
				return false;
			}
			// Check if the type in 'relatedModel' inherits from Backbone.RelationalModel
			if (!(rm.prototype instanceof Backbone.RelationalModel)) {
				warn && console.warn('Relation=%o: relatedModel does not inherit from Backbone.RelationalModel (%o).', this, rm);
				return false;
			}
			// Check if this is not a HasMany, and the reverse relation is HasMany as well
			if (this instanceof Backbone.HasMany && this.reverseRelation.type === Backbone.HasMany) {
				warn && console.warn('Relation=%o: relation is a HasMany, and the reverseRelation is HasMany as well.', this);
				return false;
			}
			// Check if we're not attempting to create a relationship on a `key` that's already used.
			if (i && _.keys(i._relations).length) {
				var existing = _.find(i._relations, function(rel) {
					return rel.key === k;
				}, this);

				if (existing) {
					warn && console.warn('Cannot create relation=%o on %o for model=%o: already taken by relation=%o.',
						this, k, i, existing);
					return false;
				}
			}

			return true;
		},

		/**
		   * Set the related model(s) for this relation
		   * @param {Backbone.Model|Backbone.Collection} related
		   */
		setRelated: function(related) {
			this.related = related;
			this.instance.attributes[this.key] = related;
		},

		/**
		   * Determine if a relation (on a different RelationalModel) is the reverse
		   * relation of the current one.
		   * @param {Backbone.Relation} relation
		   * @return {Boolean}
		   */
		_isReverseRelation: function(relation) {
			return relation.instance instanceof this.relatedModel && this.reverseRelation.key === relation.key &&
				this.key === relation.reverseRelation.key;
		},

		/**
		   * Get the reverse relations (pointing back to 'this.key' on 'this.instance') for the currently related model(s).
		   * @param {Backbone.RelationalModel} [model] Get the reverse relations for a specific model.
		   *    If not specified, 'this.related' is used.
		   * @return {Backbone.Relation[]}
		   */
		getReverseRelations: function(model) {
			var reverseRelations = [];
			// Iterate over 'model', 'this.related.models' (if this.related is a Backbone.Collection), or wrap 'this.related' in an array.
			var models = !_.isUndefined(model) ? [model] : this.related && (this.related.models || [this.related]),
				relations = null,
				relation = null;

			for (var i = 0; i < (models || []).length; i++) {
				relations = models[i].getRelations() || [];

				for (var j = 0; j < relations.length; j++) {
					relation = relations[j];

					if (this._isReverseRelation(relation)) {
						reverseRelations.push(relation);
					}
				}
			}

			return reverseRelations;
		},

		/**
		   * When `this.instance` is destroyed, cleanup our relations.
		   * Get reverse relation, call removeRelated on each.
		   */
		destroy: function() {
			this.stopListening();

			if (this instanceof Backbone.HasOne) {
				this.setRelated(null);
			} else if (this instanceof Backbone.HasMany) {
				this.setRelated(this._prepareCollection());
			}

			_.each(this.getReverseRelations(), function(relation) {
				relation.removeRelated(this.instance);
			}, this);
		}
	});

	Backbone.HasOne = Backbone.Relation.extend({
		options: {
			reverseRelation: { type: 'HasMany' }
		},

		initialize: function(opts) {
			this.listenTo(this.instance, 'relational:change:' + this.key, this.onChange);

			var related = this.findRelated(opts);
			this.setRelated(related);

			// Notify new 'related' object of the new relation.
			_.each(this.getReverseRelations(), function(relation) {
				relation.addRelated(this.instance, opts);
			}, this);
		},

		/**
		   * Find related Models.
		   * @param {Object} [options]
		   * @return {Backbone.Model}
		   */
		findRelated: function(options) {
			var related = null;

			options = _.defaults({ parse: this.options.parse }, options);

			if (this.keyContents instanceof this.relatedModel) {
				related = this.keyContents;
			} else if (this.keyContents || this.keyContents === 0) { // since 0 can be a valid `id` as well
				var opts = _.defaults({ create: this.options.createModels }, options);
				related = this.relatedModel.findOrCreate(this.keyContents, opts);
			}

			// Nullify `keyId` if we have a related model; in case it was already part of the relation
			if (related) {
				this.keyId = null;
			}

			return related;
		},

		/**
		   * Normalize and reduce `keyContents` to an `id`, for easier comparison
		   * @param {String|Number|Backbone.Model} keyContents
		   */
		setKeyContents: function(keyContents) {
			this.keyContents = keyContents;
			this.keyId = Backbone.Relational.store.resolveIdForItem(this.relatedModel, this.keyContents);
		},

		/**
		   * Event handler for `change:<key>`.
		   * If the key is changed, notify old & new reverse relations and initialize the new relation.
		   */
		onChange: function(model, attr, options) {
			// Don't accept recursive calls to onChange (like onChange->findRelated->findOrCreate->initializeRelations->addRelated->onChange)
			if (this.isLocked()) {
				return;
			}
			this.acquire();
			options = options ? _.clone(options) : {};

			// 'options.__related' is set by 'addRelated'/'removeRelated'. If it is set, the change
			// is the result of a call from a relation. If it's not, the change is the result of
			// a 'set' call on this.instance.
			var changed = _.isUndefined(options.__related),
				oldRelated = changed ? this.related : options.__related;

			if (changed) {
				this.setKeyContents(attr);
				var related = this.findRelated(options);
				this.setRelated(related);
			}

			// Notify old 'related' object of the terminated relation
			if (oldRelated && this.related !== oldRelated) {
				_.each(this.getReverseRelations(oldRelated), function(relation) {
					relation.removeRelated(this.instance, null, options);
				}, this);
			}

			// Notify new 'related' object of the new relation. Note we do re-apply even if this.related is oldRelated;
			// that can be necessary for bi-directional relations if 'this.instance' was created after 'this.related'.
			// In that case, 'this.instance' will already know 'this.related', but the reverse might not exist yet.
			_.each(this.getReverseRelations(), function(relation) {
				relation.addRelated(this.instance, options);
			}, this);

			// Fire the 'change:<key>' event if 'related' was updated
			if (!options.silent && this.related !== oldRelated) {
				var dit = this;
				this.changed = true;
				Backbone.Relational.eventQueue.add(function() {
					dit.instance.trigger('change:' + dit.key, dit.instance, dit.related, options, true);
					dit.changed = false;
				});
			}
			this.release();
		},

		/**
		   * If a new 'this.relatedModel' appears in the 'store', try to match it to the last set 'keyContents'
		   */
		tryAddRelated: function(model, coll, options) {
			if ((this.keyId || this.keyId === 0) && model.id === this.keyId) { // since 0 can be a valid `id` as well
				this.addRelated(model, options);
				this.keyId = null;
			}
		},

		addRelated: function(model, options) {
			// Allow 'model' to set up its relations before proceeding.
			// (which can result in a call to 'addRelated' from a relation of 'model')
			var dit = this;
			model.queue(function() {
				if (model !== dit.related) {
					var oldRelated = dit.related || null;
					dit.setRelated(model);
					dit.onChange(dit.instance, model, _.defaults({ __related: oldRelated }, options));
				}
			});
		},

		removeRelated: function(model, coll, options) {
			if (!this.related) {
				return;
			}

			if (model === this.related) {
				var oldRelated = this.related || null;
				this.setRelated(null);
				this.onChange(this.instance, model, _.defaults({ __related: oldRelated }, options));
			}
		}
	});

	Backbone.HasMany = Backbone.Relation.extend({
		collectionType: null,

		options: {
			reverseRelation: { type: 'HasOne' },
			collectionType: Backbone.Collection,
			collectionKey: true,
			collectionOptions: {}
		},

		initialize: function(opts) {
			this.listenTo(this.instance, 'relational:change:' + this.key, this.onChange);

			// Handle a custom 'collectionType'
			this.collectionType = this.options.collectionType;
			if (_.isFunction(this.collectionType) && this.collectionType !== Backbone.Collection && !(this.collectionType.prototype instanceof Backbone.Collection)) {
				this.collectionType = _.result(this, 'collectionType');
			}
			if (_.isString(this.collectionType)) {
				this.collectionType = Backbone.Relational.store.getObjectByName(this.collectionType);
			}
			if (this.collectionType !== Backbone.Collection && !(this.collectionType.prototype instanceof Backbone.Collection)) {
				throw new Error('`collectionType` must inherit from Backbone.Collection');
			}

			var related = this.findRelated(opts);
			this.setRelated(related);
		},

		/**
		   * Bind events and setup collectionKeys for a collection that is to be used as the backing store for a HasMany.
		   * If no 'collection' is supplied, a new collection will be created of the specified 'collectionType' option.
		   * @param {Backbone.Collection} [collection]
		   * @return {Backbone.Collection}
		   */
		_prepareCollection: function(collection) {
			if (this.related) {
				this.stopListening(this.related);
			}

			if (!collection || !(collection instanceof Backbone.Collection)) {
				var options = _.isFunction(this.options.collectionOptions) ?
					this.options.collectionOptions(this.instance) : this.options.collectionOptions;

				collection = new this.collectionType(null, options);
			}

			collection.model = this.relatedModel;

			if (this.options.collectionKey) {
				var key = this.options.collectionKey === true ? this.options.reverseRelation.key : this.options.collectionKey;

				if (collection[key] && collection[key] !== this.instance) {
					if (Backbone.Relational.showWarnings && typeof console !== 'undefined') {
						console.warn('Relation=%o; collectionKey=%s already exists on collection=%o', this, key, this.options.collectionKey);
					}
				} else if (key) {
					collection[key] = this.instance;
				}
			}

			this.listenTo(collection, 'relational:add', this.handleAddition)
				.listenTo(collection, 'relational:remove', this.handleRemoval)
				.listenTo(collection, 'relational:reset', this.handleReset);

			return collection;
		},

		/**
		   * Find related Models.
		   * @param {Object} [options]
		   * @return {Backbone.Collection}
		   */
		findRelated: function(options) {
			var related = null;

			options = _.defaults({ parse: this.options.parse }, options);

			// Replace 'this.related' by 'this.keyContents' if it is a Backbone.Collection
			if (this.keyContents instanceof Backbone.Collection) {
				this._prepareCollection(this.keyContents);
				related = this.keyContents;
			}
			// Otherwise, 'this.keyContents' should be an array of related object ids.
			// Re-use the current 'this.related' if it is a Backbone.Collection; otherwise, create a new collection.
			else {
				var toAdd = [];

				_.each(this.keyContents, function(attributes) {
					var model = null;

					if (attributes instanceof this.relatedModel) {
						model = attributes;
					} else {
						// If `merge` is true, update models here, instead of during update.
						model = this.relatedModel.findOrCreate(attributes,
							_.extend({ merge: true }, options, { create: this.options.createModels })
						);
					}

					model && toAdd.push(model);
				}, this);

				if (this.related instanceof Backbone.Collection) {
					related = this.related;
				} else {
					related = this._prepareCollection();
				}

				// By now, both `merge` and `parse` will already have been executed for models if they were specified.
				// Disable them to prevent additional calls.
				related.set(toAdd, _.defaults({ merge: false, parse: false }, options));
			}

			// Remove entries from `keyIds` that were already part of the relation (and are thus 'unchanged')
			this.keyIds = _.difference(this.keyIds, _.pluck(related.models, 'id'));

			return related;
		},

		/**
		   * Normalize and reduce `keyContents` to a list of `ids`, for easier comparison
		   * @param {String|Number|String[]|Number[]|Backbone.Collection} keyContents
		   */
		setKeyContents: function(keyContents) {
			this.keyContents = keyContents instanceof Backbone.Collection ? keyContents : null;
			this.keyIds = [];

			if (!this.keyContents && (keyContents || keyContents === 0)) { // since 0 can be a valid `id` as well
				// Handle cases the an API/user supplies just an Object/id instead of an Array
				this.keyContents = _.isArray(keyContents) ? keyContents : [keyContents];

				_.each(this.keyContents, function(item) {
					var itemId = Backbone.Relational.store.resolveIdForItem(this.relatedModel, item);
					if (itemId || itemId === 0) {
						this.keyIds.push(itemId);
					}
				}, this);
			}
		},

		/**
		   * Event handler for `change:<key>`.
		   * If the contents of the key are changed, notify old & new reverse relations and initialize the new relation.
		   */
		onChange: function(model, attr, options) {
			options = options ? _.clone(options) : {};
			this.setKeyContents(attr);
			this.changed = false;

			var related = this.findRelated(options);
			this.setRelated(related);

			if (!options.silent) {
				var dit = this;
				Backbone.Relational.eventQueue.add(function() {
					// The `changed` flag can be set in `handleAddition` or `handleRemoval`
					if (dit.changed) {
						dit.instance.trigger('change:' + dit.key, dit.instance, dit.related, options, true);
						dit.changed = false;
					}
				});
			}
		},

		/**
		   * When a model is added to a 'HasMany', trigger 'add' on 'this.instance' and notify reverse relations.
		   * (should be 'HasOne', must set 'this.instance' as their related).
		   */
		handleAddition: function(model, coll, options) {
			//console.debug('handleAddition called; args=%o', arguments);
			options = options ? _.clone(options) : {};
			this.changed = true;

			_.each(this.getReverseRelations(model), function(relation) {
				relation.addRelated(this.instance, options);
			}, this);

			// Only trigger 'add' once the newly added model is initialized (so, has its relations set up)
			var dit = this;
			!options.silent && Backbone.Relational.eventQueue.add(function() {
				dit.instance.trigger('add:' + dit.key, model, dit.related, options);
			});
		},

		/**
		   * When a model is removed from a 'HasMany', trigger 'remove' on 'this.instance' and notify reverse relations.
		   * (should be 'HasOne', which should be nullified)
		   */
		handleRemoval: function(model, coll, options) {
			//console.debug('handleRemoval called; args=%o', arguments);
			options = options ? _.clone(options) : {};
			this.changed = true;

			_.each(this.getReverseRelations(model), function(relation) {
				relation.removeRelated(this.instance, null, options);
			}, this);

			var dit = this;
			!options.silent && Backbone.Relational.eventQueue.add(function() {
				dit.instance.trigger('remove:' + dit.key, model, dit.related, options);
			});
		},

		handleReset: function(coll, options) {
			var dit = this;
			options = options ? _.clone(options) : {};
			!options.silent && Backbone.Relational.eventQueue.add(function() {
				dit.instance.trigger('reset:' + dit.key, dit.related, options);
			});
		},

		tryAddRelated: function(model, coll, options) {
			var item = _.contains(this.keyIds, model.id);

			if (item) {
				this.addRelated(model, options);
				this.keyIds = _.without(this.keyIds, model.id);
			}
		},

		addRelated: function(model, options) {
			// Allow 'model' to set up its relations before proceeding.
			// (which can result in a call to 'addRelated' from a relation of 'model')
			var dit = this;
			model.queue(function() {
				if (dit.related && !dit.related.get(model)) {
					dit.related.add(model, _.defaults({ parse: false }, options));
				}
			});
		},

		removeRelated: function(model, coll, options) {
			if (this.related.get(model)) {
				this.related.remove(model, options);
			}
		}
	});

	/**
	   * A type of Backbone.Model that also maintains relations to other models and collections.
	   * New events when compared to the original:
	   *  - 'add:<key>' (model, related collection, options)
	   *  - 'remove:<key>' (model, related collection, options)
	   *  - 'change:<key>' (model, related model or collection, options)
	   */
	Backbone.RelationalModel = Backbone.Model.extend({
		relations: null, // Relation descriptions on the prototype
		_relations: null, // Relation instances
		_isInitialized: false,
		_deferProcessing: false,
		_queue: null,
		_attributeChangeFired: false, // Keeps track of `change` event firing under some conditions (like nested `set`s)

		subModelTypeAttribute: 'type',
		subModelTypes: null,

		constructor: function(attributes, options) {
			// Nasty hack, for cases like 'model.get( <HasMany key> ).add( item )'.
			// Defer 'processQueue', so that when 'Relation.createModels' is used we trigger 'HasMany'
			// collection events only after the model is really fully set up.
			// Example: event for "p.on( 'add:jobs' )" -> "p.get('jobs').add( { company: c.id, person: p.id } )".
			if (options && options.collection) {
				var dit = this,
					collection = this.collection = options.collection;

				// Prevent `collection` from cascading down to nested models; they shouldn't go into this `if` clause.
				delete options.collection;

				this._deferProcessing = true;

				var processQueue = function(model) {
					if (model === dit) {
						dit._deferProcessing = false;
						dit.processQueue();
						collection.off('relational:add', processQueue);
					}
				};
				collection.on('relational:add', processQueue);

				// So we do process the queue eventually, regardless of whether this model actually gets added to 'options.collection'.
				_.defer(function() {
					processQueue(dit);
				});
			}

			Backbone.Relational.store.processOrphanRelations();
			Backbone.Relational.store.listenTo(this, 'relational:unregister', Backbone.Relational.store.unregister);

			this._queue = new Backbone.BlockingQueue();
			this._queue.block();
			Backbone.Relational.eventQueue.block();

			try {
				Backbone.Model.apply(this, arguments);
			} finally {
				// Try to run the global queue holding external events
				Backbone.Relational.eventQueue.unblock();
			}
		},

		/**
		   * Override 'trigger' to queue 'change' and 'change:*' events
		   */
		trigger: function(eventName) {
			if (eventName.length > 5 && eventName.indexOf('change') === 0) {
				var dit = this,
					args = arguments;

				if (!Backbone.Relational.eventQueue.isLocked()) {
					// If we're not in a more complicated nested scenario, fire the change event right away
					Backbone.Model.prototype.trigger.apply(dit, args);
				} else {
					Backbone.Relational.eventQueue.add(function() {
						// Determine if the `change` event is still valid, now that all relations are populated
						var changed = true;
						if (eventName === 'change') {
							// `hasChanged` may have gotten reset by nested calls to `set`.
							changed = dit.hasChanged() || dit._attributeChangeFired;
							dit._attributeChangeFired = false;
						} else {
							var attr = eventName.slice(7),
								rel = dit.getRelation(attr);

							if (rel) {
								// If `attr` is a relation, `change:attr` get triggered from `Relation.onChange`.
								// These take precedence over `change:attr` events triggered by `Model.set`.
								// The relation sets a fourth attribute to `true`. If this attribute is present,
								// continue triggering this event; otherwise, it's from `Model.set` and should be stopped.
								changed = (args[4] === true);

								// If this event was triggered by a relation, set the right value in `this.changed`
								// (a Collection or Model instead of raw data).
								if (changed) {
									dit.changed[attr] = args[2];
								}
								// Otherwise, this event is from `Model.set`. If the relation doesn't report a change,
								// remove attr from `dit.changed` so `hasChanged` doesn't take it into account.
								else if (!rel.changed) {
									delete dit.changed[attr];
								}
							} else if (changed) {
								dit._attributeChangeFired = true;
							}
						}

						changed && Backbone.Model.prototype.trigger.apply(dit, args);
					});
				}
			} else if (eventName === 'destroy') {
				Backbone.Model.prototype.trigger.apply(this, arguments);
				Backbone.Relational.store.unregister(this);
			} else {
				Backbone.Model.prototype.trigger.apply(this, arguments);
			}

			return this;
		},

		/**
		   * Initialize Relations present in this.relations; determine the type (HasOne/HasMany), then creates a new instance.
		   * Invoked in the first call so 'set' (which is made from the Backbone.Model constructor).
		   */
		initializeRelations: function(options) {
			this.acquire(); // Setting up relations often also involve calls to 'set', and we only want to enter this function once
			this._relations = {};

			_.each(this.relations || [], function(rel) {
				Backbone.Relational.store.initializeRelation(this, rel, options);
			}, this);

			this._isInitialized = true;
			this.release();
			this.processQueue();
		},

		/**
		   * When new values are set, notify this model's relations (also if options.silent is set).
		   * (called from `set`; Relation.setRelated locks this model before calling 'set' on it to prevent loops)
		   * @param {Object} [changedAttrs]
		   * @param {Object} [options]
		   */
		updateRelations: function(changedAttrs, options) {
			if (this._isInitialized && !this.isLocked()) {
				_.each(this._relations, function(rel) {
					if (!changedAttrs || (rel.keySource in changedAttrs || rel.key in changedAttrs)) {
						// Fetch data in `rel.keySource` if data got set in there, or `rel.key` otherwise
						var value = this.attributes[rel.keySource] || this.attributes[rel.key],
							attr = changedAttrs && (changedAttrs[rel.keySource] || changedAttrs[rel.key]);

						// Update a relation if its value differs from this model's attributes, or it's been explicitly nullified.
						// Which can also happen before the originally intended related model has been found (`val` is null).
						if (rel.related !== value || (value === null && attr === null)) {
							this.trigger('relational:change:' + rel.key, this, value, options || {});
						}
					}

					// Explicitly clear 'keySource', to prevent a leaky abstraction if 'keySource' differs from 'key'.
					if (rel.keySource !== rel.key) {
						delete this.attributes[rel.keySource];
					}
				}, this);
			}
		},

		/**
		   * Either add to the queue (if we're not initialized yet), or execute right away.
		   */
		queue: function(func) {
			this._queue.add(func);
		},

		/**
		   * Process _queue
		   */
		processQueue: function() {
			if (this._isInitialized && !this._deferProcessing && this._queue.isBlocked()) {
				this._queue.unblock();
			}
		},

		/**
		   * Get a specific relation.
		   * @param {string} attr The relation key to look for.
		   * @return {Backbone.Relation} An instance of 'Backbone.Relation', if a relation was found for 'attr', or null.
		   */
		getRelation: function(attr) {
			return this._relations[attr];
		},

		/**
		   * Get all of the created relations.
		   * @return {Backbone.Relation[]}
		   */
		getRelations: function() {
			return _.values(this._relations);
		},


		/**
		   * Get a list of ids that will be fetched on a call to `getAsync`.
		   * @param {string|Backbone.Relation} attr The relation key to fetch models for.
		   * @param [refresh=false] Add ids for models that are already in the relation, refreshing them?
		   * @return {Array} An array of ids that need to be fetched.
		   */
		getIdsToFetch: function(attr, refresh) {
			var rel = attr instanceof Backbone.Relation ? attr : this.getRelation(attr),
				ids = rel ? (rel.keyIds && rel.keyIds.slice(0)) || ((rel.keyId || rel.keyId === 0) ? [rel.keyId] : []) : [];

			// On `refresh`, add the ids for current models in the relation to `idsToFetch`
			if (refresh) {
				var models = rel.related && (rel.related.models || [rel.related]);
				_.each(models, function(model) {
					if (model.id || model.id === 0) {
						ids.push(model.id);
					}
				});
			}

			return ids;
		},

		/**
		   * Get related objects. Returns a single promise, which can either resolve immediately (if the related model[s])
		   * are already present locally, or after fetching the contents of the requested attribute.
		   * @param {string} attr The relation key to fetch models for.
		   * @param {Object} [options] Options for 'Backbone.Model.fetch' and 'Backbone.sync'.
		   * @param {Boolean} [options.refresh=false] Fetch existing models from the server as well (in order to update them).
		   * @return {jQuery.Deferred} A jQuery promise object. When resolved, its `done` callback will be called with
		   *  contents of `attr`.
		   */
		getAsync: function(attr, options) {
			// Set default `options` for fetch
			options = _.extend({ add: true, remove: false, refresh: false }, options);

			var dit = this,
				requests = [],
				rel = this.getRelation(attr),
				idsToFetch = rel && this.getIdsToFetch(rel, options.refresh),
				coll = rel.related instanceof Backbone.Collection ? rel.related : rel.relatedCollection;

			if (idsToFetch && idsToFetch.length) {
				var models = [],
					createdModels = [],
					setUrl,
					createModels = function() {
						// Find (or create) a model for each one that is to be fetched
						models = _.map(idsToFetch, function(id) {
							var model = rel.relatedModel.findModel(id);

							if (!model) {
								var attrs = {};
								attrs[rel.relatedModel.prototype.idAttribute] = id;
								model = rel.relatedModel.findOrCreate(attrs, options);
								createdModels.push(model);
							}

							return model;
						}, this);
					};

				// Try if the 'collection' can provide a url to fetch a set of models in one request.
				// This assumes that when 'Backbone.Collection.url' is a function, it can handle building of set urls.
				// To make sure it can, test if the url we got by supplying a list of models to fetch is different from
				// the one supplied for the default fetch action (without args to 'url').
				if (coll instanceof Backbone.Collection && _.isFunction(coll.url)) {
					var defaultUrl = coll.url();
					setUrl = coll.url(idsToFetch);

					if (setUrl === defaultUrl) {
						createModels();
						setUrl = coll.url(models);

						if (setUrl === defaultUrl) {
							setUrl = null;
						}
					}
				}

				if (setUrl) {
					// Do a single request to fetch all models
					var opts = _.defaults(
						{
							error: function() {
								_.each(createdModels, function(model) {
									model.trigger('destroy', model, model.collection, options);
								});

								options.error && options.error.apply(models, arguments);
							},
							url: setUrl
						},
						options
					);

					requests = [coll.fetch(opts)];
				} else {
					// Make a request per model to fetch
					if (!models.length) {
						createModels();
					}

					requests = _.map(models, function(model) {
						var opts = _.defaults(
							{
								error: function() {
									if (_.contains(createdModels, model)) {
										model.trigger('destroy', model, model.collection, options);
									}
									options.error && options.error.apply(models, arguments);
								}
							},
							options
						);
						return model.fetch(opts);
					}, this);
				}
			}

			return $.when.apply(null, requests).then(
				function() {
					return Backbone.Model.prototype.get.call(dit, attr);
				}
			);
		},

		set: function(key, value, options) {
			Backbone.Relational.eventQueue.block();

			// Duplicate backbone's behavior to allow separate key/value parameters, instead of a single 'attributes' object
			var attributes,
				result;

			if (_.isObject(key) || key == null) {
				attributes = key;
				options = value;
			} else {
				attributes = {};
				attributes[key] = value;
			}

			try {
				var id = this.id,
					newId = attributes && this.idAttribute in attributes && attributes[this.idAttribute];

				// Check if we're not setting a duplicate id before actually calling `set`.
				Backbone.Relational.store.checkId(this, newId);

				result = Backbone.Model.prototype.set.apply(this, arguments);

				// Ideal place to set up relations, if this is the first time we're here for this model
				if (!this._isInitialized && !this.isLocked()) {
					this.constructor.initializeModelHierarchy();

					// Only register models that have an id. A model will be registered when/if it gets an id later on.
					if (newId || newId === 0) {
						Backbone.Relational.store.register(this);
					}

					this.initializeRelations(options);
				}
				// The store should know about an `id` update asap
				else if (newId && newId !== id) {
					Backbone.Relational.store.update(this);
				}

				if (attributes) {
					this.updateRelations(attributes, options);
				}
			} finally {
				// Try to run the global queue holding external events
				Backbone.Relational.eventQueue.unblock();
			}

			return result;
		},

		clone: function() {
			var attributes = _.clone(this.attributes);
			if (!_.isUndefined(attributes[this.idAttribute])) {
				attributes[this.idAttribute] = null;
			}

			_.each(this.getRelations(), function(rel) {
				delete attributes[rel.key];
			});

			return new this.constructor(attributes);
		},

		/**
		   * Convert relations to JSON, omits them when required
		   */
		toJSON: function(options) {
			// If this Model has already been fully serialized in this branch once, return to avoid loops
			if (this.isLocked()) {
				return this.id;
			}

			this.acquire();
			var json = Backbone.Model.prototype.toJSON.call(this, options);

			if (this.constructor._superModel && !(this.constructor._subModelTypeAttribute in json)) {
				json[this.constructor._subModelTypeAttribute] = this.constructor._subModelTypeValue;
			}

			_.each(this._relations, function(rel) {
				var related = json[rel.key],
					includeInJSON = rel.options.includeInJSON,
					value = null;

				if (includeInJSON === true) {
					if (related && _.isFunction(related.toJSON)) {
						value = related.toJSON(options);
					}
				} else if (_.isString(includeInJSON)) {
					if (related instanceof Backbone.Collection) {
						value = related.pluck(includeInJSON);
					} else if (related instanceof Backbone.Model) {
						value = related.get(includeInJSON);
					}

					// Add ids for 'unfound' models if includeInJSON is equal to (only) the relatedModel's `idAttribute`
					if (includeInJSON === rel.relatedModel.prototype.idAttribute) {
						if (rel instanceof Backbone.HasMany) {
							value = value.concat(rel.keyIds);
						} else if (rel instanceof Backbone.HasOne) {
							value = value || rel.keyId;

							if (!value && !_.isObject(rel.keyContents)) {
								value = rel.keyContents || null;
							}
						}
					}
				} else if (_.isArray(includeInJSON)) {
					if (related instanceof Backbone.Collection) {
						value = [];
						related.each(function(model) {
							var curJson = {};
							_.each(includeInJSON, function(key) {
								curJson[key] = model.get(key);
							});
							value.push(curJson);
						});
					} else if (related instanceof Backbone.Model) {
						value = {};
						_.each(includeInJSON, function(key) {
							value[key] = related.get(key);
						});
					}
				} else {
					delete json[rel.key];
				}

				// In case of `wait: true`, Backbone will simply push whatever's passed into `save` into attributes.
				// We'll want to get this information into the JSON, even if it doesn't conform to our normal
				// expectations of what's contained in it (no model/collection for a relation, etc).
				if (value === null && options && options.wait) {
					value = related;
				}

				if (includeInJSON) {
					json[rel.keyDestination] = value;
				}

				if (rel.keyDestination !== rel.key) {
					delete json[rel.key];
				}
			});

			this.release();
			return json;
		}
	},
	{
		/**
		   *
		   * @param superModel
		   * @returns {Backbone.RelationalModel.constructor}
		   */
		setup: function(superModel) {
			// We don't want to share a relations array with a parent, as this will cause problems with reverse
			// relations. Since `relations` may also be a property or function, only use slice if we have an array.
			this.prototype.relations = (this.prototype.relations || []).slice(0);

			this._subModels = {};
			this._superModel = null;

			// If this model has 'subModelTypes' itself, remember them in the store
			if (this.prototype.hasOwnProperty('subModelTypes')) {
				Backbone.Relational.store.addSubModels(this.prototype.subModelTypes, this);
			}
			// The 'subModelTypes' property should not be inherited, so reset it.
			else {
				this.prototype.subModelTypes = null;
			}

			// Initialize all reverseRelations that belong to this new model.
			_.each(this.prototype.relations || [], function(rel) {
				if (!rel.model) {
					rel.model = this;
				}

				if (rel.reverseRelation && rel.model === this) {
					var preInitialize = true;
					if (_.isString(rel.relatedModel)) {
						/**
						   * The related model might not be defined for two reasons
						   *  1. it is related to itself
						   *  2. it never gets defined, e.g. a typo
						   *  3. the model hasn't been defined yet, but will be later
						   * In neither of these cases do we need to pre-initialize reverse relations.
						   * However, for 3. (which is, to us, indistinguishable from 2.), we do need to attempt
						   * setting up this relation again later, in case the related model is defined later.
						   */
						var relatedModel = Backbone.Relational.store.getObjectByName(rel.relatedModel);
						preInitialize = relatedModel && (relatedModel.prototype instanceof Backbone.RelationalModel);
					}

					if (preInitialize) {
						Backbone.Relational.store.initializeRelation(null, rel);
					} else if (_.isString(rel.relatedModel)) {
						Backbone.Relational.store.addOrphanRelation(rel);
					}
				}
			}, this);

			return this;
		},

		/**
		   * Create a 'Backbone.Model' instance based on 'attributes'.
		   * @param {Object} attributes
		   * @param {Object} [options]
		   * @return {Backbone.Model}
		   */
		build: function(attributes, options) {
			// 'build' is a possible entrypoint; it's possible no model hierarchy has been determined yet.
			this.initializeModelHierarchy();

			// Determine what type of (sub)model should be built if applicable.
			var model = this._findSubModelType(this, attributes) || this;

			return new model(attributes, options);
		},

		/**
		   * Determines what type of (sub)model should be built if applicable.
		   * Looks up the proper subModelType in 'this._subModels', recursing into
		   * types until a match is found.  Returns the applicable 'Backbone.Model'
		   * or null if no match is found.
		   * @param {Backbone.Model} type
		   * @param {Object} attributes
		   * @return {Backbone.Model}
		   */
		_findSubModelType: function(type, attributes) {
			if (type._subModels && type.prototype.subModelTypeAttribute in attributes) {
				var subModelTypeAttribute = attributes[type.prototype.subModelTypeAttribute];
				var subModelType = type._subModels[subModelTypeAttribute];
				if (subModelType) {
					return subModelType;
				} else {
					// Recurse into subModelTypes to find a match
					for (subModelTypeAttribute in type._subModels) {
						subModelType = this._findSubModelType(type._subModels[subModelTypeAttribute], attributes);
						if (subModelType) {
							return subModelType;
						}
					}
				}
			}

			return null;
		},

		/**
		   *
		   */
		initializeModelHierarchy: function() {
			// Inherit any relations that have been defined in the parent model.
			this.inheritRelations();

			// If we came here through 'build' for a model that has 'subModelTypes' then try to initialize the ones that
			// haven't been resolved yet.
			if (this.prototype.subModelTypes) {
				var resolvedSubModels = _.keys(this._subModels);
				var unresolvedSubModels = _.omit(this.prototype.subModelTypes, resolvedSubModels);
				_.each(unresolvedSubModels, function(subModelTypeName) {
					var subModelType = Backbone.Relational.store.getObjectByName(subModelTypeName);
					subModelType && subModelType.initializeModelHierarchy();
				});
			}
		},

		inheritRelations: function() {
			// Bail out if we've been here before.
			if (!_.isUndefined(this._superModel) && !_.isNull(this._superModel)) {
				return;
			}
			// Try to initialize the _superModel.
			Backbone.Relational.store.setupSuperModel(this);

			// If a superModel has been found, copy relations from the _superModel if they haven't been inherited automatically
			// (due to a redefinition of 'relations').
			if (this._superModel) {
				// The _superModel needs a chance to initialize its own inherited relations before we attempt to inherit relations
				// from the _superModel. You don't want to call 'initializeModelHierarchy' because that could cause sub-models of
				// this class to inherit their relations before this class has had chance to inherit it's relations.
				this._superModel.inheritRelations();
				if (this._superModel.prototype.relations) {
					// Find relations that exist on the '_superModel', but not yet on this model.
					var inheritedRelations = _.filter(this._superModel.prototype.relations || [], function(superRel) {
						return !_.any(this.prototype.relations || [], function(rel) {
							return superRel.relatedModel === rel.relatedModel && superRel.key === rel.key;
						}, this);
					}, this);

					this.prototype.relations = inheritedRelations.concat(this.prototype.relations);
				}
			}
			// Otherwise, make sure we don't get here again for this type by making '_superModel' false so we fail the
			// isUndefined/isNull check next time.
			else {
				this._superModel = false;
			}
		},

		/**
		   * Find an instance of `this` type in 'Backbone.Relational.store'.
		   * A new model is created if no matching model is found, `attributes` is an object, and `options.create` is true.
		   * - If `attributes` is a string or a number, `findOrCreate` will query the `store` and return a model if found.
		   * - If `attributes` is an object and is found in the store, the model will be updated with `attributes` unless `options.merge` is `false`.
		   * @param {Object|String|Number} attributes Either a model's id, or the attributes used to create or update a model.
		   * @param {Object} [options]
		   * @param {Boolean} [options.create=true]
		   * @param {Boolean} [options.merge=true]
		   * @param {Boolean} [options.parse=false]
		   * @return {Backbone.RelationalModel}
		   */
		findOrCreate: function(attributes, options) {
			options || (options = {});
			var parsedAttributes = (_.isObject(attributes) && options.parse && this.prototype.parse) ?
				this.prototype.parse(_.clone(attributes)) : attributes;

			// If specified, use a custom `find` function to match up existing models to the given attributes.
			// Otherwise, try to find an instance of 'this' model type in the store
			var model = this.findModel(parsedAttributes);

			// If we found an instance, update it with the data in 'item' (unless 'options.merge' is false).
			// If not, create an instance (unless 'options.create' is false).
			if (_.isObject(attributes)) {
				if (model && options.merge !== false) {
					// Make sure `options.collection` and `options.url` doesn't cascade to nested models
					delete options.collection;
					delete options.url;

					model.set(parsedAttributes, options);
				} else if (!model && options.create !== false) {
					model = this.build(parsedAttributes, _.defaults({ parse: false }, options));
				}
			}

			return model;
		},

		/**
		   * Find an instance of `this` type in 'Backbone.Relational.store'.
		   * - If `attributes` is a string or a number, `find` will query the `store` and return a model if found.
		   * - If `attributes` is an object and is found in the store, the model will be updated with `attributes` unless `options.merge` is `false`.
		   * @param {Object|String|Number} attributes Either a model's id, or the attributes used to create or update a model.
		   * @param {Object} [options]
		   * @param {Boolean} [options.merge=true]
		   * @param {Boolean} [options.parse=false]
		   * @return {Backbone.RelationalModel}
		   */
		find: function(attributes, options) {
			options || (options = {});
			options.create = false;
			return this.findOrCreate(attributes, options);
		},

		/**
		   * A hook to override the matching when updating (or creating) a model.
		   * The default implementation is to look up the model by id in the store.
		   * @param {Object} attributes
		   * @returns {Backbone.RelationalModel}
		   */
		findModel: function(attributes) {
			return Backbone.Relational.store.find(this, attributes);
		}
	});
	_.extend(Backbone.RelationalModel.prototype, Backbone.Semaphore);

	/**
	   * Override Backbone.Collection._prepareModel, so objects will be built using the correct type
	   * if the collection.model has subModels.
	   * Attempts to find a model for `attrs` in Backbone.store through `findOrCreate`
	   * (which sets the new properties on it if found), or instantiates a new model.
	   */
	Backbone.Collection.prototype.__prepareModel = Backbone.Collection.prototype._prepareModel;
	Backbone.Collection.prototype._prepareModel = function(attrs, options) {
		var model;

		if (attrs instanceof Backbone.Model) {
			if (!attrs.collection) {
				attrs.collection = this;
			}
			model = attrs;
		} else {
			options = options ? _.clone(options) : {};
			options.collection = this;

			if (typeof this.model.findOrCreate !== 'undefined') {
				model = this.model.findOrCreate(attrs, options);
			} else {
				model = new this.model(attrs, options);
			}

			if (model && model.validationError) {
				this.trigger('invalid', this, attrs, options);
				model = false;
			}
		}

		return model;
	};


	/**
	   * Override Backbone.Collection.set, so we'll create objects from attributes where required,
	   * and update the existing models. Also, trigger 'relational:add'.
	   */
	var set = Backbone.Collection.prototype.__set = Backbone.Collection.prototype.set;
	Backbone.Collection.prototype.set = function(models, options) {
		// Short-circuit if this Collection doesn't hold RelationalModels
		if (!(this.model.prototype instanceof Backbone.RelationalModel)) {
			return set.call(this, models, options);
		}

		if (options && options.parse) {
			models = this.parse(models, options);
		}

		var singular = !_.isArray(models),
			newModels = [],
			toAdd = [],
			model = null;

		models = singular ? (models ? [models] : []) : _.clone(models);

		//console.debug( 'calling add on coll=%o; model=%o, options=%o', this, models, options );
		for (var i = 0; i < models.length; i++) {
			model = models[i];
			if (!(model instanceof Backbone.Model)) {
				model = Backbone.Collection.prototype._prepareModel.call(this, model, options);
			}
			if (model) {
				toAdd.push(model);
				if (!(this.get(model) || this.get(model.cid))) {
					newModels.push(model);
				}
				// If we arrive in `add` while performing a `set` (after a create, so the model gains an `id`),
				// we may get here before `_onModelEvent` has had the chance to update `_byId`.
				else if (model.id !== null && model.id !== undefined) {
					this._byId[model.id] = model;
				}
			}
		}

		// Add 'models' in a single batch, so the original add will only be called once (and thus 'sort', etc).
		// If `parse` was specified, the collection and contained models have been parsed now.
		toAdd = singular ? (toAdd.length ? toAdd[0] : null) : toAdd;
		var result = set.call(this, toAdd, _.defaults({ merge: false, parse: false }, options));

		for (i = 0; i < newModels.length; i++) {
			model = newModels[i];
			// Fire a `relational:add` event for any model in `newModels` that has actually been added to the collection.
			if (this.get(model) || this.get(model.cid)) {
				this.trigger('relational:add', model, this, options);
			}
		}

		return result;
	};

	/**
	   * Override 'Backbone.Collection.remove' to trigger 'relational:remove'.
	   */
	var remove = Backbone.Collection.prototype.__remove = Backbone.Collection.prototype.remove;
	Backbone.Collection.prototype.remove = function(models, options) {
		// Short-circuit if this Collection doesn't hold RelationalModels
		if (!(this.model.prototype instanceof Backbone.RelationalModel)) {
			return remove.call(this, models, options);
		}

		var singular = !_.isArray(models),
			toRemove = [];

		models = singular ? (models ? [models] : []) : _.clone(models);
		options || (options = {});

		//console.debug('calling remove on coll=%o; models=%o, options=%o', this, models, options );
		_.each(models, function(model) {
			model = this.get(model) || (model && this.get(model.cid));
			model && toRemove.push(model);
		}, this);

		var result = remove.call(this, singular ? (toRemove.length ? toRemove[0] : null) : toRemove, options);

		_.each(toRemove, function(model) {
			this.trigger('relational:remove', model, this, options);
		}, this);

		return result;
	};

	/**
	   * Override 'Backbone.Collection.reset' to trigger 'relational:reset'.
	   */
	var reset = Backbone.Collection.prototype.__reset = Backbone.Collection.prototype.reset;
	Backbone.Collection.prototype.reset = function(models, options) {
		options = _.extend({ merge: true }, options);
		var result = reset.call(this, models, options);

		if (this.model.prototype instanceof Backbone.RelationalModel) {
			this.trigger('relational:reset', this, options);
		}

		return result;
	};

	/**
	   * Override 'Backbone.Collection.sort' to trigger 'relational:reset'.
	   */
	var sort = Backbone.Collection.prototype.__sort = Backbone.Collection.prototype.sort;
	Backbone.Collection.prototype.sort = function(options) {
		var result = sort.call(this, options);

		if (this.model.prototype instanceof Backbone.RelationalModel) {
			this.trigger('relational:reset', this, options);
		}

		return result;
	};

	/**
	   * Override 'Backbone.Collection.trigger' so 'add', 'remove' and 'reset' events are queued until relations
	   * are ready.
	   */
	var trigger = Backbone.Collection.prototype.__trigger = Backbone.Collection.prototype.trigger;
	Backbone.Collection.prototype.trigger = function(eventName) {
		// Short-circuit if this Collection doesn't hold RelationalModels
		if (!(this.model.prototype instanceof Backbone.RelationalModel)) {
			return trigger.apply(this, arguments);
		}

		if (eventName === 'add' || eventName === 'remove' || eventName === 'reset' || eventName === 'sort') {
			var dit = this,
				args = arguments;

			if (_.isObject(args[3])) {
				args = _.toArray(args);
				// the fourth argument is the option object.
				// we need to clone it, as it could be modified while we wait on the eventQueue to be unblocked
				args[3] = _.clone(args[3]);
			}

			Backbone.Relational.eventQueue.add(function() {
				trigger.apply(dit, args);
			});
		} else {
			trigger.apply(this, arguments);
		}

		return this;
	};

	// Override .extend() to automatically call .setup()
	Backbone.RelationalModel.extend = function(protoProps, classProps) {
		var child = Backbone.Model.extend.call(this, protoProps, classProps);

		child.setup(this);

		return child;
	};
}));
// MarionetteJS (Backbone.Marionette)
// ----------------------------------
// v2.4.1
//
// Copyright (c)2015 Derick Bailey, Muted Solutions, LLC.
// Distributed under MIT license
//
// http://marionettejs.com


/*!
 * Includes BabySitter
 * https://github.com/marionettejs/backbone.babysitter/
 *
 * Includes Wreqr
 * https://github.com/marionettejs/backbone.wreqr/
 */


(function(root, factory) {

	/* istanbul ignore next */
	//if (typeof define === 'function' && define.amd) {
	//	define(['backbone', 'underscore'], function (Backbone, _) {
	//		return (root.Marionette = root.Mn = factory(root, Backbone, _));
	//	});
	//} else if (typeof exports !== 'undefined') {
	//	var Backbone = require('backbone');
	//	var _ = require('underscore');
	//	module.exports = factory(root, Backbone, _);
	//} else {
	root.Marionette = root.Mn = factory(root, root.Backbone, root._);
	//}

}(this, function(root, Backbone, _) {
	'use strict';

	/* istanbul ignore next */
	// Backbone.BabySitter
	// -------------------
	// v0.1.6
	//
	// Copyright (c)2015 Derick Bailey, Muted Solutions, LLC.
	// Distributed under MIT license
	//
	// http://github.com/marionettejs/backbone.babysitter
	(function(Backbone, _) {
		"use strict";
		var previousChildViewContainer = Backbone.ChildViewContainer;
		// BabySitter.ChildViewContainer
		// -----------------------------
		//
		// Provide a container to store, retrieve and
		// shut down child views.
		Backbone.ChildViewContainer = function(Backbone, _) {
			// Container Constructor
			// ---------------------
			var Container = function(views) {
				this._views = {};
				this._indexByModel = {};
				this._indexByCustom = {};
				this._updateLength();
				_.each(views, this.add, this);
			};
			// Container Methods
			// -----------------
			_.extend(Container.prototype, {
				// Add a view to this container. Stores the view
				// by `cid` and makes it searchable by the model
				// cid (and model itself). Optionally specify
				// a custom key to store an retrieve the view.
				add: function(view, customIndex) {
					var viewCid = view.cid;
					// store the view
					this._views[viewCid] = view;
					// index it by model
					if (view.model) {
						this._indexByModel[view.model.cid] = viewCid;
					}
					// index by custom
					if (customIndex) {
						this._indexByCustom[customIndex] = viewCid;
					}
					this._updateLength();
					return this;
				},
				// Find a view by the model that was attached to
				// it. Uses the model's `cid` to find it.
				findByModel: function(model) {
					return this.findByModelCid(model.cid);
				},
				// Find a view by the `cid` of the model that was attached to
				// it. Uses the model's `cid` to find the view `cid` and
				// retrieve the view using it.
				findByModelCid: function(modelCid) {
					var viewCid = this._indexByModel[modelCid];
					return this.findByCid(viewCid);
				},
				// Find a view by a custom indexer.
				findByCustom: function(index) {
					var viewCid = this._indexByCustom[index];
					return this.findByCid(viewCid);
				},
				// Find by index. This is not guaranteed to be a
				// stable index.
				findByIndex: function(index) {
					return _.values(this._views)[index];
				},
				// retrieve a view by its `cid` directly
				findByCid: function(cid) {
					return this._views[cid];
				},
				// Remove a view
				remove: function(view) {
					var viewCid = view.cid;
					// delete model index
					if (view.model) {
						delete this._indexByModel[view.model.cid];
					}
					// delete custom index
					_.any(this._indexByCustom, function(cid, key) {
						if (cid === viewCid) {
							delete this._indexByCustom[key];
							return true;
						}
					}, this);
					// remove the view from the container
					delete this._views[viewCid];
					// update the length
					this._updateLength();
					return this;
				},
				// Call a method on every view in the container,
				// passing parameters to the call method one at a
				// time, like `function.call`.
				call: function(method) {
					this.apply(method, _.tail(arguments));
				},
				// Apply a method on every view in the container,
				// passing parameters to the call method one at a
				// time, like `function.apply`.
				apply: function(method, args) {
					_.each(this._views, function(view) {
						if (_.isFunction(view[method])) {
							view[method].apply(view, args || []);
						}
					});
				},
				// Update the `.length` attribute on this container
				_updateLength: function() {
					this.length = _.size(this._views);
				}
			});
			// Borrowing this code from Backbone.Collection:
			// http://backbonejs.org/docs/backbone.html#section-106
			//
			// Mix in methods from Underscore, for iteration, and other
			// collection related features.
			var methods = ["forEach", "each", "map", "find", "detect", "filter", "select", "reject", "every", "all", "some", "any", "include", "contains", "invoke", "toArray", "first", "initial", "rest", "last", "without", "isEmpty", "pluck", "reduce"];
			_.each(methods, function(method) {
				Container.prototype[method] = function() {
					var views = _.values(this._views);
					var args = [views].concat(_.toArray(arguments));
					return _[method].apply(_, args);
				};
			});
			// return the public API
			return Container;
		}(Backbone, _);
		Backbone.ChildViewContainer.VERSION = "0.1.6";
		Backbone.ChildViewContainer.noConflict = function() {
			Backbone.ChildViewContainer = previousChildViewContainer;
			return this;
		};
		return Backbone.ChildViewContainer;
	})(Backbone, _);

	/* istanbul ignore next */
	// Backbone.Wreqr (Backbone.Marionette)
	// ----------------------------------
	// v1.3.1
	//
	// Copyright (c)2014 Derick Bailey, Muted Solutions, LLC.
	// Distributed under MIT license
	//
	// http://github.com/marionettejs/backbone.wreqr
	(function(Backbone, _) {
		"use strict";
		var previousWreqr = Backbone.Wreqr;
		var Wreqr = Backbone.Wreqr = {};
		Backbone.Wreqr.VERSION = "1.3.1";
		Backbone.Wreqr.noConflict = function() {
			Backbone.Wreqr = previousWreqr;
			return this;
		};
		// Handlers
		// --------
		// A registry of functions to call, given a name
		Wreqr.Handlers = function(Backbone, _) {
			"use strict";
			// Constructor
			// -----------
			var Handlers = function(options) {
				this.options = options;
				this._wreqrHandlers = {};
				if (_.isFunction(this.initialize)) {
					this.initialize(options);
				}
			};
			Handlers.extend = Backbone.Model.extend;
			// Instance Members
			// ----------------
			_.extend(Handlers.prototype, Backbone.Events, {
				// Add multiple handlers using an object literal configuration
				setHandlers: function(handlers) {
					_.each(handlers, function(handler, name) {
						var context = null;
						if (_.isObject(handler) && !_.isFunction(handler)) {
							context = handler.context;
							handler = handler.callback;
						}
						this.setHandler(name, handler, context);
					}, this);
				},
				// Add a handler for the given name, with an
				// optional context to run the handler within
				setHandler: function(name, handler, context) {
					var config = {
						callback: handler,
						context: context
					};
					this._wreqrHandlers[name] = config;
					this.trigger("handler:add", name, handler, context);
				},
				// Determine whether or not a handler is registered
				hasHandler: function(name) {
					return !!this._wreqrHandlers[name];
				},
				// Get the currently registered handler for
				// the specified name. Throws an exception if
				// no handler is found.
				getHandler: function(name) {
					var config = this._wreqrHandlers[name];
					if (!config) {
						return;
					}
					return function() {
						var args = Array.prototype.slice.apply(arguments);
						return config.callback.apply(config.context, args);
					};
				},
				// Remove a handler for the specified name
				removeHandler: function(name) {
					delete this._wreqrHandlers[name];
				},
				// Remove all handlers from this registry
				removeAllHandlers: function() {
					this._wreqrHandlers = {};
				}
			});
			return Handlers;
		}(Backbone, _);
		// Wreqr.CommandStorage
		// --------------------
		//
		// Store and retrieve commands for execution.
		Wreqr.CommandStorage = function() {
			"use strict";
			// Constructor function
			var CommandStorage = function(options) {
				this.options = options;
				this._commands = {};
				if (_.isFunction(this.initialize)) {
					this.initialize(options);
				}
			};
			// Instance methods
			_.extend(CommandStorage.prototype, Backbone.Events, {
				// Get an object literal by command name, that contains
				// the `commandName` and the `instances` of all commands
				// represented as an array of arguments to process
				getCommands: function(commandName) {
					var commands = this._commands[commandName];
					// we don't have it, so add it
					if (!commands) {
						// build the configuration
						commands = {
							command: commandName,
							instances: []
						};
						// store it
						this._commands[commandName] = commands;
					}
					return commands;
				},
				// Add a command by name, to the storage and store the
				// args for the command
				addCommand: function(commandName, args) {
					var command = this.getCommands(commandName);
					command.instances.push(args);
				},
				// Clear all commands for the given `commandName`
				clearCommands: function(commandName) {
					var command = this.getCommands(commandName);
					command.instances = [];
				}
			});
			return CommandStorage;
		}();
		// Wreqr.Commands
		// --------------
		//
		// A simple command pattern implementation. Register a command
		// handler and execute it.
		Wreqr.Commands = function(Wreqr) {
			"use strict";
			return Wreqr.Handlers.extend({
				// default storage type
				storageType: Wreqr.CommandStorage,
				constructor: function(options) {
					this.options = options || {};
					this._initializeStorage(this.options);
					this.on("handler:add", this._executeCommands, this);
					var args = Array.prototype.slice.call(arguments);
					Wreqr.Handlers.prototype.constructor.apply(this, args);
				},
				// Execute a named command with the supplied args
				execute: function(name, args) {
					name = arguments[0];
					args = Array.prototype.slice.call(arguments, 1);
					if (this.hasHandler(name)) {
						this.getHandler(name).apply(this, args);
					} else {
						this.storage.addCommand(name, args);
					}
				},
				// Internal method to handle bulk execution of stored commands
				_executeCommands: function(name, handler, context) {
					var command = this.storage.getCommands(name);
					// loop through and execute all the stored command instances
					_.each(command.instances, function(args) {
						handler.apply(context, args);
					});
					this.storage.clearCommands(name);
				},
				// Internal method to initialize storage either from the type's
				// `storageType` or the instance `options.storageType`.
				_initializeStorage: function(options) {
					var storage;
					var StorageType = options.storageType || this.storageType;
					if (_.isFunction(StorageType)) {
						storage = new StorageType();
					} else {
						storage = StorageType;
					}
					this.storage = storage;
				}
			});
		}(Wreqr);
		// Wreqr.RequestResponse
		// ---------------------
		//
		// A simple request/response implementation. Register a
		// request handler, and return a response from it
		Wreqr.RequestResponse = function(Wreqr) {
			"use strict";
			return Wreqr.Handlers.extend({
				request: function() {
					var name = arguments[0];
					var args = Array.prototype.slice.call(arguments, 1);
					if (this.hasHandler(name)) {
						return this.getHandler(name).apply(this, args);
					}
				}
			});
		}(Wreqr);
		// Event Aggregator
		// ----------------
		// A pub-sub object that can be used to decouple various parts
		// of an application through event-driven architecture.
		Wreqr.EventAggregator = function(Backbone, _) {
			"use strict";
			var EA = function() {};
			// Copy the `extend` function used by Backbone's classes
			EA.extend = Backbone.Model.extend;
			// Copy the basic Backbone.Events on to the event aggregator
			_.extend(EA.prototype, Backbone.Events);
			return EA;
		}(Backbone, _);
		// Wreqr.Channel
		// --------------
		//
		// An object that wraps the three messaging systems:
		// EventAggregator, RequestResponse, Commands
		Wreqr.Channel = function(Wreqr) {
			"use strict";
			var Channel = function(channelName) {
				this.vent = new Backbone.Wreqr.EventAggregator();
				this.reqres = new Backbone.Wreqr.RequestResponse();
				this.commands = new Backbone.Wreqr.Commands();
				this.channelName = channelName;
			};
			_.extend(Channel.prototype, {
				// Remove all handlers from the messaging systems of this channel
				reset: function() {
					this.vent.off();
					this.vent.stopListening();
					this.reqres.removeAllHandlers();
					this.commands.removeAllHandlers();
					return this;
				},
				// Connect a hash of events; one for each messaging system
				connectEvents: function(hash, context) {
					this._connect("vent", hash, context);
					return this;
				},
				connectCommands: function(hash, context) {
					this._connect("commands", hash, context);
					return this;
				},
				connectRequests: function(hash, context) {
					this._connect("reqres", hash, context);
					return this;
				},
				// Attach the handlers to a given message system `type`
				_connect: function(type, hash, context) {
					if (!hash) {
						return;
					}
					context = context || this;
					var method = type === "vent" ? "on" : "setHandler";
					_.each(hash, function(fn, eventName) {
						this[type][method](eventName, _.bind(fn, context));
					}, this);
				}
			});
			return Channel;
		}(Wreqr);
		// Wreqr.Radio
		// --------------
		//
		// An object that lets you communicate with many channels.
		Wreqr.radio = function(Wreqr) {
			"use strict";
			var Radio = function() {
				this._channels = {};
				this.vent = {};
				this.commands = {};
				this.reqres = {};
				this._proxyMethods();
			};
			_.extend(Radio.prototype, {
				channel: function(channelName) {
					if (!channelName) {
						throw new Error("Channel must receive a name");
					}
					return this._getChannel(channelName);
				},
				_getChannel: function(channelName) {
					var channel = this._channels[channelName];
					if (!channel) {
						channel = new Wreqr.Channel(channelName);
						this._channels[channelName] = channel;
					}
					return channel;
				},
				_proxyMethods: function() {
					_.each(["vent", "commands", "reqres"], function(system) {
						_.each(messageSystems[system], function(method) {
							this[system][method] = proxyMethod(this, system, method);
						}, this);
					}, this);
				}
			});
			var messageSystems = {
				vent: ["on", "off", "trigger", "once", "stopListening", "listenTo", "listenToOnce"],
				commands: ["execute", "setHandler", "setHandlers", "removeHandler", "removeAllHandlers"],
				reqres: ["request", "setHandler", "setHandlers", "removeHandler", "removeAllHandlers"]
			};
			var proxyMethod = function(radio, system, method) {
				return function(channelName) {
					var messageSystem = radio._getChannel(channelName)[system];
					var args = Array.prototype.slice.call(arguments, 1);
					return messageSystem[method].apply(messageSystem, args);
				};
			};
			return new Radio();
		}(Wreqr);
		return Backbone.Wreqr;
	})(Backbone, _);

	var previousMarionette = root.Marionette;
	var previousMn = root.Mn;

	var Marionette = Backbone.Marionette = {};

	Marionette.VERSION = '2.4.1';

	Marionette.noConflict = function() {
		root.Marionette = previousMarionette;
		root.Mn = previousMn;
		return this;
	};

	Backbone.Marionette = Marionette;

	// Get the Deferred creator for later use
	Marionette.Deferred = Backbone.$.Deferred;

	/* jshint unused: false */ /* global console */

	// Helpers
	// -------

	// Marionette.extend
	// -----------------

	// Borrow the Backbone `extend` method so we can use it as needed
	Marionette.extend = Backbone.Model.extend;

	// Marionette.isNodeAttached
	// -------------------------

	// Determine if `el` is a child of the document
	Marionette.isNodeAttached = function(el) {
		return Backbone.$.contains(document.documentElement, el);
	};

	// Merge `keys` from `options` onto `this`
	Marionette.mergeOptions = function(options, keys) {
		if (!options) {
			return;
		}
		_.extend(this, _.pick(options, keys));
	};

	// Marionette.getOption
	// --------------------

	// Retrieve an object, function or other value from a target
	// object or its `options`, with `options` taking precedence.
	Marionette.getOption = function(target, optionName) {
		if (!target || !optionName) {
			return;
		}
		if (target.options && (target.options[optionName] !== undefined)) {
			return target.options[optionName];
		} else {
			return target[optionName];
		}
	};

	// Proxy `Marionette.getOption`
	Marionette.proxyGetOption = function(optionName) {
		return Marionette.getOption(this, optionName);
	};

	// Similar to `_.result`, this is a simple helper
	// If a function is provided we call it with context
	// otherwise just return the value. If the value is
	// undefined return a default value
	Marionette._getValue = function(value, context, params) {
		if (_.isFunction(value)) {
			value = params ? value.apply(context, params) : value.call(context);
		}
		return value;
	};

	// Marionette.normalizeMethods
	// ----------------------

	// Pass in a mapping of events => functions or function names
	// and return a mapping of events => functions
	Marionette.normalizeMethods = function(hash) {
		return _.reduce(hash, function(normalizedHash, method, name) {
			if (!_.isFunction(method)) {
				method = this[method];
			}
			if (method) {
				normalizedHash[name] = method;
			}
			return normalizedHash;
		}, {}, this);
	};

	// utility method for parsing @ui. syntax strings
	// into associated selector
	Marionette.normalizeUIString = function(uiString, ui) {
		return uiString.replace(/@ui\.[a-zA-Z_$0-9]*/g, function(r) {
			return ui[r.slice(4)];
		});
	};

	// allows for the use of the @ui. syntax within
	// a given key for triggers and events
	// swaps the @ui with the associated selector.
	// Returns a new, non-mutated, parsed events hash.
	Marionette.normalizeUIKeys = function(hash, ui) {
		return _.reduce(hash, function(memo, val, key) {
			var normalizedKey = Marionette.normalizeUIString(key, ui);
			memo[normalizedKey] = val;
			return memo;
		}, {});
	};

	// allows for the use of the @ui. syntax within
	// a given value for regions
	// swaps the @ui with the associated selector
	Marionette.normalizeUIValues = function(hash, ui, properties) {
		_.each(hash, function(val, key) {
			if (_.isString(val)) {
				hash[key] = Marionette.normalizeUIString(val, ui);
			} else if (_.isObject(val) && _.isArray(properties)) {
				_.extend(val, Marionette.normalizeUIValues(_.pick(val, properties), ui));
				/* Value is an object, and we got an array of embedded property names to normalize. */
				_.each(properties, function(property) {
					var propertyVal = val[property];
					if (_.isString(propertyVal)) {
						val[property] = Marionette.normalizeUIString(propertyVal, ui);
					}
				});
			}
		});
		return hash;
	};

	// Mix in methods from Underscore, for iteration, and other
	// collection related features.
	// Borrowing this code from Backbone.Collection:
	// http://backbonejs.org/docs/backbone.html#section-121
	Marionette.actAsCollection = function(object, listProperty) {
		var methods = [
			'forEach', 'each', 'map', 'find', 'detect', 'filter',
			'select', 'reject', 'every', 'all', 'some', 'any', 'include',
			'contains', 'invoke', 'toArray', 'first', 'initial', 'rest',
			'last', 'without', 'isEmpty', 'pluck'
		];

		_.each(methods, function(method) {
			object[method] = function() {
				var list = _.values(_.result(this, listProperty));
				var args = [list].concat(_.toArray(arguments));
				return _[method].apply(_, args);
			};
		});
	};

	var deprecate = Marionette.deprecate = function(message, test) {
		if (_.isObject(message)) {
			message = (
				message.prev + ' is going to be removed in the future. ' +
					'Please use ' + message.next + ' instead.' +
					(message.url ? ' See: ' + message.url : '')
			);
		}

		if ((test === undefined || !test) && !deprecate._cache[message]) {
			deprecate._warn('Deprecation warning: ' + message);
			deprecate._cache[message] = true;
		}
	};

	deprecate._warn = typeof console !== 'undefined' && (console.warn || console.log) || function() {};
	deprecate._cache = {};

	/* jshint maxstatements: 14, maxcomplexity: 7 */

	// Trigger Method
	// --------------

	Marionette._triggerMethod = (function() {
		// split the event name on the ":"
		var splitter = /(^|:)(\w)/gi;

		// take the event section ("section1:section2:section3")
		// and turn it in to uppercase name
		function getEventName(match, prefix, eventName) {
			return eventName.toUpperCase();
		}

		return function(context, event, args) {
			var noEventArg = arguments.length < 3;
			if (noEventArg) {
				args = event;
				event = args[0];
			}

			// get the method name from the event name
			var methodName = 'on' + event.replace(splitter, getEventName);
			var method = context[methodName];
			var result;

			// call the onMethodName if it exists
			if (_.isFunction(method)) {
				// pass all args, except the event name
				result = method.apply(context, noEventArg ? _.rest(args) : args);
			}

			// trigger the event, if a trigger method exists
			if (_.isFunction(context.trigger)) {
				if (noEventArg + args.length > 1) {
					context.trigger.apply(context, noEventArg ? args : [event].concat(_.drop(args, 0)));
				} else {
					context.trigger(event);
				}
			}

			return result;
		};
	})();

	// Trigger an event and/or a corresponding method name. Examples:
	//
	// `this.triggerMethod("foo")` will trigger the "foo" event and
	// call the "onFoo" method.
	//
	// `this.triggerMethod("foo:bar")` will trigger the "foo:bar" event and
	// call the "onFooBar" method.
	Marionette.triggerMethod = function(event) {
		return Marionette._triggerMethod(this, arguments);
	};

	// triggerMethodOn invokes triggerMethod on a specific context
	//
	// e.g. `Marionette.triggerMethodOn(view, 'show')`
	// will trigger a "show" event or invoke onShow the view.
	Marionette.triggerMethodOn = function(context) {
		var fnc = _.isFunction(context.triggerMethod) ?
			context.triggerMethod :
			Marionette.triggerMethod;

		return fnc.apply(context, _.rest(arguments));
	};

	// DOM Refresh
	// -----------

	// Monitor a view's state, and after it has been rendered and shown
	// in the DOM, trigger a "dom:refresh" event every time it is
	// re-rendered.

	Marionette.MonitorDOMRefresh = function(view) {

		// track when the view has been shown in the DOM,
		// using a Marionette.Region (or by other means of triggering "show")
		function handleShow() {
			view._isShown = true;
			triggerDOMRefresh();
		}

		// track when the view has been rendered
		function handleRender() {
			view._isRendered = true;
			triggerDOMRefresh();
		}

		// Trigger the "dom:refresh" event and corresponding "onDomRefresh" method
		function triggerDOMRefresh() {
			if (view._isShown && view._isRendered && Marionette.isNodeAttached(view.el)) {
				if (_.isFunction(view.triggerMethod)) {
					view.triggerMethod('dom:refresh');
				}
			}
		}

		view.on({
			show: handleShow,
			render: handleRender
		});
	};

	/* jshint maxparams: 5 */

	// Bind Entity Events & Unbind Entity Events
	// -----------------------------------------
	//
	// These methods are used to bind/unbind a backbone "entity" (e.g. collection/model)
	// to methods on a target object.
	//
	// The first parameter, `target`, must have the Backbone.Events module mixed in.
	//
	// The second parameter is the `entity` (Backbone.Model, Backbone.Collection or
	// any object that has Backbone.Events mixed in) to bind the events from.
	//
	// The third parameter is a hash of { "event:name": "eventHandler" }
	// configuration. Multiple handlers can be separated by a space. A
	// function can be supplied instead of a string handler name.

	(function(Marionette) {
		'use strict';

		// Bind the event to handlers specified as a string of
		// handler names on the target object
		function bindFromStrings(target, entity, evt, methods) {
			var methodNames = methods.split(/\s+/);

			_.each(methodNames, function(methodName) {

				var method = target[methodName];
				if (!method) {
					throw new Marionette.Error('Method "' + methodName +
						'" was configured as an event handler, but does not exist.');
				}

				target.listenTo(entity, evt, method);
			});
		}

		// Bind the event to a supplied callback function
		function bindToFunction(target, entity, evt, method) {
			target.listenTo(entity, evt, method);
		}

		// Bind the event to handlers specified as a string of
		// handler names on the target object
		function unbindFromStrings(target, entity, evt, methods) {
			var methodNames = methods.split(/\s+/);

			_.each(methodNames, function(methodName) {
				var method = target[methodName];
				target.stopListening(entity, evt, method);
			});
		}

		// Bind the event to a supplied callback function
		function unbindToFunction(target, entity, evt, method) {
			target.stopListening(entity, evt, method);
		}

		// generic looping function
		function iterateEvents(target, entity, bindings, functionCallback, stringCallback) {
			if (!entity || !bindings) {
				return;
			}

			// type-check bindings
			if (!_.isObject(bindings)) {
				throw new Marionette.Error({
					message: 'Bindings must be an object or function.',
					url: 'marionette.functions.html#marionettebindentityevents'
				});
			}

			// allow the bindings to be a function
			bindings = Marionette._getValue(bindings, target);

			// iterate the bindings and bind them
			_.each(bindings, function(methods, evt) {

				// allow for a function as the handler,
				// or a list of event names as a string
				if (_.isFunction(methods)) {
					functionCallback(target, entity, evt, methods);
				} else {
					stringCallback(target, entity, evt, methods);
				}

			});
		}

		// Export Public API
		Marionette.bindEntityEvents = function(target, entity, bindings) {
			iterateEvents(target, entity, bindings, bindToFunction, bindFromStrings);
		};

		Marionette.unbindEntityEvents = function(target, entity, bindings) {
			iterateEvents(target, entity, bindings, unbindToFunction, unbindFromStrings);
		};

		// Proxy `bindEntityEvents`
		Marionette.proxyBindEntityEvents = function(entity, bindings) {
			return Marionette.bindEntityEvents(this, entity, bindings);
		};

		// Proxy `unbindEntityEvents`
		Marionette.proxyUnbindEntityEvents = function(entity, bindings) {
			return Marionette.unbindEntityEvents(this, entity, bindings);
		};
	})(Marionette);


	// Error
	// -----

	var errorProps = ['description', 'fileName', 'lineNumber', 'name', 'message', 'number'];

	Marionette.Error = Marionette.extend.call(Error, {
		urlRoot: 'http://marionettejs.com/docs/v' + Marionette.VERSION + '/',

		constructor: function(message, options) {
			if (_.isObject(message)) {
				options = message;
				message = options.message;
			} else if (!options) {
				options = {};
			}

			var error = Error.call(this, message);
			_.extend(this, _.pick(error, errorProps), _.pick(options, errorProps));

			this.captureStackTrace();

			if (options.url) {
				this.url = this.urlRoot + options.url;
			}
		},

		captureStackTrace: function() {
			if (Error.captureStackTrace) {
				Error.captureStackTrace(this, Marionette.Error);
			}
		},

		toString: function() {
			return this.name + ': ' + this.message + (this.url ? ' See: ' + this.url : '');
		}
	});

	Marionette.Error.extend = Marionette.extend;

	// Callbacks
	// ---------

	// A simple way of managing a collection of callbacks
	// and executing them at a later point in time, using jQuery's
	// `Deferred` object.
	Marionette.Callbacks = function() {
		this._deferred = Marionette.Deferred();
		this._callbacks = [];
	};

	_.extend(Marionette.Callbacks.prototype, {

		// Add a callback to be executed. Callbacks added here are
		// guaranteed to execute, even if they are added after the
		// `run` method is called.
		add: function(callback, contextOverride) {
			var promise = _.result(this._deferred, 'promise');

			this._callbacks.push({ cb: callback, ctx: contextOverride });

			promise.then(function(args) {
				if (contextOverride) {
					args.context = contextOverride;
				}
				callback.call(args.context, args.options);
			});
		},

		// Run all registered callbacks with the context specified.
		// Additional callbacks can be added after this has been run
		// and they will still be executed.
		run: function(options, context) {
			this._deferred.resolve({
				options: options,
				context: context
			});
		},

		// Resets the list of callbacks to be run, allowing the same list
		// to be run multiple times - whenever the `run` method is called.
		reset: function() {
			var callbacks = this._callbacks;
			this._deferred = Marionette.Deferred();
			this._callbacks = [];

			_.each(callbacks, function(cb) {
				this.add(cb.cb, cb.ctx);
			}, this);
		}
	});

	// Controller
	// ----------

	// A multi-purpose object to use as a controller for
	// modules and routers, and as a mediator for workflow
	// and coordination of other objects, views, and more.
	Marionette.Controller = function(options) {
		this.options = options || {};

		if (_.isFunction(this.initialize)) {
			this.initialize(this.options);
		}
	};

	Marionette.Controller.extend = Marionette.extend;

	// Controller Methods
	// --------------

	// Ensure it can trigger events with Backbone.Events
	_.extend(Marionette.Controller.prototype, Backbone.Events, {
		destroy: function() {
			Marionette._triggerMethod(this, 'before:destroy', arguments);
			Marionette._triggerMethod(this, 'destroy', arguments);

			this.stopListening();
			this.off();
			return this;
		},

		// import the `triggerMethod` to trigger events with corresponding
		// methods if the method exists
		triggerMethod: Marionette.triggerMethod,

		// A handy way to merge options onto the instance
		mergeOptions: Marionette.mergeOptions,

		// Proxy `getOption` to enable getting options from this or this.options by name.
		getOption: Marionette.proxyGetOption

	});

	// Object
	// ------

	// A Base Class that other Classes should descend from.
	// Object borrows many conventions and utilities from Backbone.
	Marionette.Object = function(options) {
		this.options = _.extend({}, _.result(this, 'options'), options);

		this.initialize.apply(this, arguments);
	};

	Marionette.Object.extend = Marionette.extend;

	// Object Methods
	// --------------

	// Ensure it can trigger events with Backbone.Events
	_.extend(Marionette.Object.prototype, Backbone.Events, {

		//this is a noop method intended to be overridden by classes that extend from this base
		initialize: function() {},

		destroy: function() {
			this.triggerMethod('before:destroy');
			this.triggerMethod('destroy');
			this.stopListening();

			return this;
		},

		// Import the `triggerMethod` to trigger events with corresponding
		// methods if the method exists
		triggerMethod: Marionette.triggerMethod,

		// A handy way to merge options onto the instance
		mergeOptions: Marionette.mergeOptions,

		// Proxy `getOption` to enable getting options from this or this.options by name.
		getOption: Marionette.proxyGetOption,

		// Proxy `bindEntityEvents` to enable binding view's events from another entity.
		bindEntityEvents: Marionette.proxyBindEntityEvents,

		// Proxy `unbindEntityEvents` to enable unbinding view's events from another entity.
		unbindEntityEvents: Marionette.proxyUnbindEntityEvents
	});

	/* jshint maxcomplexity: 16, maxstatements: 45, maxlen: 120 */

	// Region
	// ------

	// Manage the visual regions of your composite application. See
	// http://lostechies.com/derickbailey/2011/12/12/composite-js-apps-regions-and-region-managers/

	Marionette.Region = Marionette.Object.extend({
			constructor: function(options) {

				// set options temporarily so that we can get `el`.
				// options will be overriden by Object.constructor
				this.options = options || {};
				this.el = this.getOption('el');

				// Handle when this.el is passed in as a $ wrapped element.
				this.el = this.el instanceof Backbone.$ ? this.el[0] : this.el;

				if (!this.el) {
					throw new Marionette.Error({
						name: 'NoElError',
						message: 'An "el" must be specified for a region.'
					});
				}

				this.$el = this.getEl(this.el);
				Marionette.Object.call(this, options);
			},

			// Displays a backbone view instance inside of the region.
			// Handles calling the `render` method for you. Reads content
			// directly from the `el` attribute. Also calls an optional
			// `onShow` and `onDestroy` method on your view, just after showing
			// or just before destroying the view, respectively.
			// The `preventDestroy` option can be used to prevent a view from
			// the old view being destroyed on show.
			// The `forceShow` option can be used to force a view to be
			// re-rendered if it's already shown in the region.
			show: function(view, options) {
				if (!this._ensureElement()) {
					return;
				}

				this._ensureViewIsIntact(view);

				var showOptions = options || {};
				var isDifferentView = view !== this.currentView;
				var preventDestroy = !!showOptions.preventDestroy;
				var forceShow = !!showOptions.forceShow;

				// We are only changing the view if there is a current view to change to begin with
				var isChangingView = !!this.currentView;

				// Only destroy the current view if we don't want to `preventDestroy` and if
				// the view given in the first argument is different than `currentView`
				var _shouldDestroyView = isDifferentView && !preventDestroy;

				// Only show the view given in the first argument if it is different than
				// the current view or if we want to re-show the view. Note that if
				// `_shouldDestroyView` is true, then `_shouldShowView` is also necessarily true.
				var _shouldShowView = isDifferentView || forceShow;

				if (isChangingView) {
					this.triggerMethod('before:swapOut', this.currentView, this, options);
				}

				if (this.currentView) {
					delete this.currentView._parent;
				}

				if (_shouldDestroyView) {
					this.empty();

					// A `destroy` event is attached to the clean up manually removed views.
					// We need to detach this event when a new view is going to be shown as it
					// is no longer relevant.
				} else if (isChangingView && _shouldShowView) {
					this.currentView.off('destroy', this.empty, this);
				}

				if (_shouldShowView) {

					// We need to listen for if a view is destroyed
					// in a way other than through the region.
					// If this happens we need to remove the reference
					// to the currentView since once a view has been destroyed
					// we can not reuse it.
					view.once('destroy', this.empty, this);
					view.render();

					view._parent = this;

					if (isChangingView) {
						this.triggerMethod('before:swap', view, this, options);
					}

					this.triggerMethod('before:show', view, this, options);
					Marionette.triggerMethodOn(view, 'before:show', view, this, options);

					if (isChangingView) {
						this.triggerMethod('swapOut', this.currentView, this, options);
					}

					// An array of views that we're about to display
					var attachedRegion = Marionette.isNodeAttached(this.el);

					// The views that we're about to attach to the document
					// It's important that we prevent _getNestedViews from being executed unnecessarily
					// as it's a potentially-slow method
					var displayedViews = [];

					var triggerBeforeAttach = showOptions.triggerBeforeAttach || this.triggerBeforeAttach;
					var triggerAttach = showOptions.triggerAttach || this.triggerAttach;

					if (attachedRegion && triggerBeforeAttach) {
						displayedViews = this._displayedViews(view);
						this._triggerAttach(displayedViews, 'before:');
					}

					this.attachHtml(view);
					this.currentView = view;

					if (attachedRegion && triggerAttach) {
						displayedViews = this._displayedViews(view);
						this._triggerAttach(displayedViews);
					}

					if (isChangingView) {
						this.triggerMethod('swap', view, this, options);
					}

					this.triggerMethod('show', view, this, options);
					Marionette.triggerMethodOn(view, 'show', view, this, options);

					return this;
				}

				return this;
			},

			triggerBeforeAttach: true,
			triggerAttach: true,

			_triggerAttach: function(views, prefix) {
				var eventName = (prefix || '') + 'attach';
				_.each(views, function(view) {
					Marionette.triggerMethodOn(view, eventName, view, this);
				}, this);
			},

			_displayedViews: function(view) {
				return _.union([view], _.result(view, '_getNestedViews') || []);
			},

			_ensureElement: function() {
				if (!_.isObject(this.el)) {
					this.$el = this.getEl(this.el);
					this.el = this.$el[0];
				}

				if (!this.$el || this.$el.length === 0) {
					if (this.getOption('allowMissingEl')) {
						return false;
					} else {
						throw new Marionette.Error('An "el" ' + this.$el.selector + ' must exist in DOM');
					}
				}
				return true;
			},

			_ensureViewIsIntact: function(view) {
				if (!view) {
					throw new Marionette.Error({
						name: 'ViewNotValid',
						message: 'The view passed is undefined and therefore invalid. You must pass a view instance to show.'
					});
				}

				if (view.isDestroyed) {
					throw new Marionette.Error({
						name: 'ViewDestroyedError',
						message: 'View (cid: "' + view.cid + '") has already been destroyed and cannot be used.'
					});
				}
			},

			// Override this method to change how the region finds the DOM
			// element that it manages. Return a jQuery selector object scoped
			// to a provided parent el or the document if none exists.
			getEl: function(el) {
				return Backbone.$(el, Marionette._getValue(this.options.parentEl, this));
			},

			// Override this method to change how the new view is
			// appended to the `$el` that the region is managing
			attachHtml: function(view) {
				this.$el.contents().detach();

				this.el.appendChild(view.el);
			},

			// Destroy the current view, if there is one. If there is no
			// current view, it does nothing and returns immediately.
			empty: function(options) {
				var view = this.currentView;

				var preventDestroy = Marionette._getValue(options, 'preventDestroy', this);
				// If there is no view in the region
				// we should not remove anything
				if (!view) {
					return;
				}

				view.off('destroy', this.empty, this);
				this.triggerMethod('before:empty', view);
				if (!preventDestroy) {
					this._destroyView();
				}
				this.triggerMethod('empty', view);

				// Remove region pointer to the currentView
				delete this.currentView;

				if (preventDestroy) {
					this.$el.contents().detach();
				}

				return this;
			},

			// call 'destroy' or 'remove', depending on which is found
			// on the view (if showing a raw Backbone view or a Marionette View)
			_destroyView: function() {
				var view = this.currentView;

				if (view.destroy && !view.isDestroyed) {
					view.destroy();
				} else if (view.remove) {
					view.remove();

					// appending isDestroyed to raw Backbone View allows regions
					// to throw a ViewDestroyedError for this view
					view.isDestroyed = true;
				}
			},

			// Attach an existing view to the region. This
			// will not call `render` or `onShow` for the new view,
			// and will not replace the current HTML for the `el`
			// of the region.
			attachView: function(view) {
				this.currentView = view;
				return this;
			},

			// Checks whether a view is currently present within
			// the region. Returns `true` if there is and `false` if
			// no view is present.
			hasView: function() {
				return !!this.currentView;
			},

			// Reset the region by destroying any existing view and
			// clearing out the cached `$el`. The next time a view
			// is shown via this region, the region will re-query the
			// DOM for the region's `el`.
			reset: function() {
				this.empty();

				if (this.$el) {
					this.el = this.$el.selector;
				}

				delete this.$el;
				return this;
			}

		},

		// Static Methods
		{

			// Build an instance of a region by passing in a configuration object
			// and a default region class to use if none is specified in the config.
			//
			// The config object should either be a string as a jQuery DOM selector,
			// a Region class directly, or an object literal that specifies a selector,
			// a custom regionClass, and any options to be supplied to the region:
			//
			// ```js
			// {
			//   selector: "#foo",
			//   regionClass: MyCustomRegion,
			//   allowMissingEl: false
			// }
			// ```
			//
			buildRegion: function(regionConfig, DefaultRegionClass) {
				if (_.isString(regionConfig)) {
					return this._buildRegionFromSelector(regionConfig, DefaultRegionClass);
				}

				if (regionConfig.selector || regionConfig.el || regionConfig.regionClass) {
					return this._buildRegionFromObject(regionConfig, DefaultRegionClass);
				}

				if (_.isFunction(regionConfig)) {
					return this._buildRegionFromRegionClass(regionConfig);
				}

				throw new Marionette.Error({
					message: 'Improper region configuration type.',
					url: 'marionette.region.html#region-configuration-types'
				});
			},

			// Build the region from a string selector like '#foo-region'
			_buildRegionFromSelector: function(selector, DefaultRegionClass) {
				return new DefaultRegionClass({ el: selector });
			},

			// Build the region from a configuration object
			// ```js
			// { selector: '#foo', regionClass: FooRegion, allowMissingEl: false }
			// ```
			_buildRegionFromObject: function(regionConfig, DefaultRegionClass) {
				var RegionClass = regionConfig.regionClass || DefaultRegionClass;
				var options = _.omit(regionConfig, 'selector', 'regionClass');

				if (regionConfig.selector && !options.el) {
					options.el = regionConfig.selector;
				}

				return new RegionClass(options);
			},

			// Build the region directly from a given `RegionClass`
			_buildRegionFromRegionClass: function(RegionClass) {
				return new RegionClass();
			}
		});

	// Region Manager
	// --------------

	// Manage one or more related `Marionette.Region` objects.
	Marionette.RegionManager = Marionette.Controller.extend({
		constructor: function(options) {
			this._regions = {};
			this.length = 0;

			Marionette.Controller.call(this, options);

			this.addRegions(this.getOption('regions'));
		},

		// Add multiple regions using an object literal or a
		// function that returns an object literal, where
		// each key becomes the region name, and each value is
		// the region definition.
		addRegions: function(regionDefinitions, defaults) {
			regionDefinitions = Marionette._getValue(regionDefinitions, this, arguments);

			return _.reduce(regionDefinitions, function(regions, definition, name) {
				if (_.isString(definition)) {
					definition = { selector: definition };
				}
				if (definition.selector) {
					definition = _.defaults({}, definition, defaults);
				}

				regions[name] = this.addRegion(name, definition);
				return regions;
			}, {}, this);
		},

		// Add an individual region to the region manager,
		// and return the region instance
		addRegion: function(name, definition) {
			var region;

			if (definition instanceof Marionette.Region) {
				region = definition;
			} else {
				region = Marionette.Region.buildRegion(definition, Marionette.Region);
			}

			this.triggerMethod('before:add:region', name, region);

			region._parent = this;
			this._store(name, region);

			this.triggerMethod('add:region', name, region);
			return region;
		},

		// Get a region by name
		get: function(name) {
			return this._regions[name];
		},

		// Gets all the regions contained within
		// the `regionManager` instance.
		getRegions: function() {
			return _.clone(this._regions);
		},

		// Remove a region by name
		removeRegion: function(name) {
			var region = this._regions[name];
			this._remove(name, region);

			return region;
		},

		// Empty all regions in the region manager, and
		// remove them
		removeRegions: function() {
			var regions = this.getRegions();
			_.each(this._regions, function(region, name) {
				this._remove(name, region);
			}, this);

			return regions;
		},

		// Empty all regions in the region manager, but
		// leave them attached
		emptyRegions: function() {
			var regions = this.getRegions();
			_.invoke(regions, 'empty');
			return regions;
		},

		// Destroy all regions and shut down the region
		// manager entirely
		destroy: function() {
			this.removeRegions();
			return Marionette.Controller.prototype.destroy.apply(this, arguments);
		},

		// internal method to store regions
		_store: function(name, region) {
			if (!this._regions[name]) {
				this.length++;
			}

			this._regions[name] = region;
		},

		// internal method to remove a region
		_remove: function(name, region) {
			this.triggerMethod('before:remove:region', name, region);
			region.empty();
			region.stopListening();

			delete region._parent;
			delete this._regions[name];
			this.length--;
			this.triggerMethod('remove:region', name, region);
		}
	});

	Marionette.actAsCollection(Marionette.RegionManager.prototype, '_regions');


	// Template Cache
	// --------------

	// Manage templates stored in `<script>` blocks,
	// caching them for faster access.
	Marionette.TemplateCache = function(templateId) {
		this.templateId = templateId;
	};

	// TemplateCache object-level methods. Manage the template
	// caches from these method calls instead of creating
	// your own TemplateCache instances
	_.extend(Marionette.TemplateCache, {
		templateCaches: {},

		// Get the specified template by id. Either
		// retrieves the cached version, or loads it
		// from the DOM.
		get: function(templateId, options) {
			var cachedTemplate = this.templateCaches[templateId];

			if (!cachedTemplate) {
				cachedTemplate = new Marionette.TemplateCache(templateId);
				this.templateCaches[templateId] = cachedTemplate;
			}

			return cachedTemplate.load(options);
		},

		// Clear templates from the cache. If no arguments
		// are specified, clears all templates:
		// `clear()`
		//
		// If arguments are specified, clears each of the
		// specified templates from the cache:
		// `clear("#t1", "#t2", "...")`
		clear: function() {
			var i;
			var args = _.toArray(arguments);
			var length = args.length;

			if (length > 0) {
				for (i = 0; i < length; i++) {
					delete this.templateCaches[args[i]];
				}
			} else {
				this.templateCaches = {};
			}
		}
	});

	// TemplateCache instance methods, allowing each
	// template cache object to manage its own state
	// and know whether or not it has been loaded
	_.extend(Marionette.TemplateCache.prototype, {

		// Internal method to load the template
		load: function(options) {
			// Guard clause to prevent loading this template more than once
			if (this.compiledTemplate) {
				return this.compiledTemplate;
			}

			// Load the template and compile it
			var template = this.loadTemplate(this.templateId, options);
			this.compiledTemplate = this.compileTemplate(template, options);

			return this.compiledTemplate;
		},

		// Load a template from the DOM, by default. Override
		// this method to provide your own template retrieval
		// For asynchronous loading with AMD/RequireJS, consider
		// using a template-loader plugin as described here:
		// https://github.com/marionettejs/backbone.marionette/wiki/Using-marionette-with-requirejs
		loadTemplate: function(templateId, options) {
			var template = Backbone.$(templateId).html();

			if (!template || template.length === 0) {
				throw new Marionette.Error({
					name: 'NoTemplateError',
					message: 'Could not find template: "' + templateId + '"'
				});
			}

			return template;
		},

		// Pre-compile the template before caching it. Override
		// this method if you do not need to pre-compile a template
		// (JST / RequireJS for example) or if you want to change
		// the template engine used (Handebars, etc).
		compileTemplate: function(rawTemplate, options) {
			return _.template(rawTemplate, options);
		}
	});

	// Renderer
	// --------

	// Render a template with data by passing in the template
	// selector and the data to render.
	Marionette.Renderer = {

		// Render a template with data. The `template` parameter is
		// passed to the `TemplateCache` object to retrieve the
		// template function. Override this method to provide your own
		// custom rendering and template handling for all of Marionette.
		render: function(template, data) {
			if (!template) {
				throw new Marionette.Error({
					name: 'TemplateNotFoundError',
					message: 'Cannot render the template since its false, null or undefined.'
				});
			}

			var templateFunc = _.isFunction(template) ? template : Marionette.TemplateCache.get(template);

			return templateFunc(data);
		}
	};


	/* jshint maxlen: 114, nonew: false */
	// View
	// ----

	// The core view class that other Marionette views extend from.
	Marionette.View = Backbone.View.extend({
		isDestroyed: false,

		constructor: function(options) {
			_.bindAll(this, 'render');

			options = Marionette._getValue(options, this);

			// this exposes view options to the view initializer
			// this is a backfill since backbone removed the assignment
			// of this.options
			// at some point however this may be removed
			this.options = _.extend({}, _.result(this, 'options'), options);

			this._behaviors = Marionette.Behaviors(this);

			Backbone.View.call(this, this.options);

			Marionette.MonitorDOMRefresh(this);
		},

		// Get the template for this view
		// instance. You can set a `template` attribute in the view
		// definition or pass a `template: "whatever"` parameter in
		// to the constructor options.
		getTemplate: function() {
			return this.getOption('template');
		},

		// Serialize a model by returning its attributes. Clones
		// the attributes to allow modification.
		serializeModel: function(model) {
			return model.toJSON.apply(model, _.rest(arguments));
		},

		// Mix in template helper methods. Looks for a
		// `templateHelpers` attribute, which can either be an
		// object literal, or a function that returns an object
		// literal. All methods and attributes from this object
		// are copies to the object passed in.
		mixinTemplateHelpers: function(target) {
			target = target || {};
			var templateHelpers = this.getOption('templateHelpers');
			templateHelpers = Marionette._getValue(templateHelpers, this);
			return _.extend(target, templateHelpers);
		},

		// normalize the keys of passed hash with the views `ui` selectors.
		// `{"@ui.foo": "bar"}`
		normalizeUIKeys: function(hash) {
			var uiBindings = _.result(this, '_uiBindings');
			return Marionette.normalizeUIKeys(hash, uiBindings || _.result(this, 'ui'));
		},

		// normalize the values of passed hash with the views `ui` selectors.
		// `{foo: "@ui.bar"}`
		normalizeUIValues: function(hash, properties) {
			var ui = _.result(this, 'ui');
			var uiBindings = _.result(this, '_uiBindings');
			return Marionette.normalizeUIValues(hash, uiBindings || ui, properties);
		},

		// Configure `triggers` to forward DOM events to view
		// events. `triggers: {"click .foo": "do:foo"}`
		configureTriggers: function() {
			if (!this.triggers) {
				return;
			}

			// Allow `triggers` to be configured as a function
			var triggers = this.normalizeUIKeys(_.result(this, 'triggers'));

			// Configure the triggers, prevent default
			// action and stop propagation of DOM events
			return _.reduce(triggers, function(events, value, key) {
				events[key] = this._buildViewTrigger(value);
				return events;
			}, {}, this);
		},

		// Overriding Backbone.View's delegateEvents to handle
		// the `triggers`, `modelEvents`, and `collectionEvents` configuration
		delegateEvents: function(events) {
			this._delegateDOMEvents(events);
			this.bindEntityEvents(this.model, this.getOption('modelEvents'));
			this.bindEntityEvents(this.collection, this.getOption('collectionEvents'));

			_.each(this._behaviors, function(behavior) {
				behavior.bindEntityEvents(this.model, behavior.getOption('modelEvents'));
				behavior.bindEntityEvents(this.collection, behavior.getOption('collectionEvents'));
			}, this);

			return this;
		},

		// internal method to delegate DOM events and triggers
		_delegateDOMEvents: function(eventsArg) {
			var events = Marionette._getValue(eventsArg || this.events, this);

			// normalize ui keys
			events = this.normalizeUIKeys(events);
			if (_.isUndefined(eventsArg)) {
				this.events = events;
			}

			var combinedEvents = {};

			// look up if this view has behavior events
			var behaviorEvents = _.result(this, 'behaviorEvents') || {};
			var triggers = this.configureTriggers();
			var behaviorTriggers = _.result(this, 'behaviorTriggers') || {};

			// behavior events will be overriden by view events and or triggers
			_.extend(combinedEvents, behaviorEvents, events, triggers, behaviorTriggers);

			Backbone.View.prototype.delegateEvents.call(this, combinedEvents);
		},

		// Overriding Backbone.View's undelegateEvents to handle unbinding
		// the `triggers`, `modelEvents`, and `collectionEvents` config
		undelegateEvents: function() {
			Backbone.View.prototype.undelegateEvents.apply(this, arguments);

			this.unbindEntityEvents(this.model, this.getOption('modelEvents'));
			this.unbindEntityEvents(this.collection, this.getOption('collectionEvents'));

			_.each(this._behaviors, function(behavior) {
				behavior.unbindEntityEvents(this.model, behavior.getOption('modelEvents'));
				behavior.unbindEntityEvents(this.collection, behavior.getOption('collectionEvents'));
			}, this);

			return this;
		},

		// Internal helper method to verify whether the view hasn't been destroyed
		_ensureViewIsIntact: function() {
			if (this.isDestroyed) {
				throw new Marionette.Error({
					name: 'ViewDestroyedError',
					message: 'View (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
				});
			}
		},

		// Default `destroy` implementation, for removing a view from the
		// DOM and unbinding it. Regions will call this method
		// for you. You can specify an `onDestroy` method in your view to
		// add custom code that is called after the view is destroyed.
		destroy: function() {
			if (this.isDestroyed) {
				return this;
			}

			var args = _.toArray(arguments);

			this.triggerMethod.apply(this, ['before:destroy'].concat(args));

			// mark as destroyed before doing the actual destroy, to
			// prevent infinite loops within "destroy" event handlers
			// that are trying to destroy other views
			this.isDestroyed = true;
			this.triggerMethod.apply(this, ['destroy'].concat(args));

			// unbind UI elements
			this.unbindUIElements();

			this.isRendered = false;

			// remove the view from the DOM
			this.remove();

			// Call destroy on each behavior after
			// destroying the view.
			// This unbinds event listeners
			// that behaviors have registered for.
			_.invoke(this._behaviors, 'destroy', args);

			return this;
		},

		bindUIElements: function() {
			this._bindUIElements();
			_.invoke(this._behaviors, this._bindUIElements);
		},

		// This method binds the elements specified in the "ui" hash inside the view's code with
		// the associated jQuery selectors.
		_bindUIElements: function() {
			if (!this.ui) {
				return;
			}

			// store the ui hash in _uiBindings so they can be reset later
			// and so re-rendering the view will be able to find the bindings
			if (!this._uiBindings) {
				this._uiBindings = this.ui;
			}

			// get the bindings result, as a function or otherwise
			var bindings = _.result(this, '_uiBindings');

			// empty the ui so we don't have anything to start with
			this.ui = {};

			// bind each of the selectors
			_.each(bindings, function(selector, key) {
				this.ui[key] = this.$(selector);
			}, this);
		},

		// This method unbinds the elements specified in the "ui" hash
		unbindUIElements: function() {
			this._unbindUIElements();
			_.invoke(this._behaviors, this._unbindUIElements);
		},

		_unbindUIElements: function() {
			if (!this.ui || !this._uiBindings) {
				return;
			}

			// delete all of the existing ui bindings
			_.each(this.ui, function($el, name) {
				delete this.ui[name];
			}, this);

			// reset the ui element to the original bindings configuration
			this.ui = this._uiBindings;
			delete this._uiBindings;
		},

		// Internal method to create an event handler for a given `triggerDef` like
		// 'click:foo'
		_buildViewTrigger: function(triggerDef) {
			var hasOptions = _.isObject(triggerDef);

			var options = _.defaults({}, (hasOptions ? triggerDef : {}), {
				preventDefault: true,
				stopPropagation: true
			});

			var eventName = hasOptions ? options.event : triggerDef;

			return function(e) {
				if (e) {
					if (e.preventDefault && options.preventDefault) {
						e.preventDefault();
					}

					if (e.stopPropagation && options.stopPropagation) {
						e.stopPropagation();
					}
				}

				var args = {
					view: this,
					model: this.model,
					collection: this.collection
				};

				this.triggerMethod(eventName, args);
			};
		},

		setElement: function() {
			var ret = Backbone.View.prototype.setElement.apply(this, arguments);

			// proxy behavior $el to the view's $el.
			// This is needed because a view's $el proxy
			// is not set until after setElement is called.
			_.invoke(this._behaviors, 'proxyViewProperties', this);

			return ret;
		},

		// import the `triggerMethod` to trigger events with corresponding
		// methods if the method exists
		triggerMethod: function() {
			var ret = Marionette._triggerMethod(this, arguments);

			this._triggerEventOnBehaviors(arguments);
			this._triggerEventOnParentLayout(arguments[0], _.rest(arguments));

			return ret;
		},

		_triggerEventOnBehaviors: function(args) {
			var triggerMethod = Marionette._triggerMethod;
			var behaviors = this._behaviors;
			// Use good ol' for as this is a very hot function
			for (var i = 0, length = behaviors && behaviors.length; i < length; i++) {
				triggerMethod(behaviors[i], args);
			}
		},

		_triggerEventOnParentLayout: function(eventName, args) {
			var layoutView = this._parentLayoutView();
			if (!layoutView) {
				return;
			}

			// invoke triggerMethod on parent view
			var eventPrefix = Marionette.getOption(layoutView, 'childViewEventPrefix');
			var prefixedEventName = eventPrefix + ':' + eventName;

			Marionette._triggerMethod(layoutView, [prefixedEventName, this].concat(args));

			// call the parent view's childEvents handler
			var childEvents = Marionette.getOption(layoutView, 'childEvents');
			var normalizedChildEvents = layoutView.normalizeMethods(childEvents);

			if (!!normalizedChildEvents && _.isFunction(normalizedChildEvents[eventName])) {
				normalizedChildEvents[eventName].apply(layoutView, [this].concat(args));
			}
		},

		// This method returns any views that are immediate
		// children of this view
		_getImmediateChildren: function() {
			return [];
		},

		// Returns an array of every nested view within this view
		_getNestedViews: function() {
			var children = this._getImmediateChildren();

			if (!children.length) {
				return children;
			}

			return _.reduce(children, function(memo, view) {
				if (!view._getNestedViews) {
					return memo;
				}
				return memo.concat(view._getNestedViews());
			}, children);
		},

		// Internal utility for building an ancestor
		// view tree list.
		_getAncestors: function() {
			var ancestors = [];
			var parent = this._parent;

			while (parent) {
				ancestors.push(parent);
				parent = parent._parent;
			}

			return ancestors;
		},

		// Returns the containing parent view.
		_parentLayoutView: function() {
			var ancestors = this._getAncestors();
			return _.find(ancestors, function(parent) {
				return parent instanceof Marionette.LayoutView;
			});
		},

		// Imports the "normalizeMethods" to transform hashes of
		// events=>function references/names to a hash of events=>function references
		normalizeMethods: Marionette.normalizeMethods,

		// A handy way to merge passed-in options onto the instance
		mergeOptions: Marionette.mergeOptions,

		// Proxy `getOption` to enable getting options from this or this.options by name.
		getOption: Marionette.proxyGetOption,

		// Proxy `bindEntityEvents` to enable binding view's events from another entity.
		bindEntityEvents: Marionette.proxyBindEntityEvents,

		// Proxy `unbindEntityEvents` to enable unbinding view's events from another entity.
		unbindEntityEvents: Marionette.proxyUnbindEntityEvents
	});

	// Item View
	// ---------

	// A single item view implementation that contains code for rendering
	// with underscore.js templates, serializing the view's model or collection,
	// and calling several methods on extended views, such as `onRender`.
	Marionette.ItemView = Marionette.View.extend({

		// Setting up the inheritance chain which allows changes to
		// Marionette.View.prototype.constructor which allows overriding
		constructor: function() {
			Marionette.View.apply(this, arguments);
		},

		// Serialize the model or collection for the view. If a model is
		// found, the view's `serializeModel` is called. If a collection is found,
		// each model in the collection is serialized by calling
		// the view's `serializeCollection` and put into an `items` array in
		// the resulting data. If both are found, defaults to the model.
		// You can override the `serializeData` method in your own view definition,
		// to provide custom serialization for your view's data.
		serializeData: function() {
			if (!this.model && !this.collection) {
				return {};
			}

			var args = [this.model || this.collection];
			if (arguments.length) {
				args.push.apply(args, arguments);
			}

			if (this.model) {
				return this.serializeModel.apply(this, args);
			} else {
				return {
					items: this.serializeCollection.apply(this, args)
				};
			}
		},

		// Serialize a collection by serializing each of its models.
		serializeCollection: function(collection) {
			return collection.toJSON.apply(collection, _.rest(arguments));
		},

		// Render the view, defaulting to underscore.js templates.
		// You can override this in your view definition to provide
		// a very specific rendering for your view. In general, though,
		// you should override the `Marionette.Renderer` object to
		// change how Marionette renders views.
		render: function() {
			this._ensureViewIsIntact();

			this.triggerMethod('before:render', this);

			this._renderTemplate();
			this.isRendered = true;
			this.bindUIElements();

			this.triggerMethod('render', this);

			return this;
		},

		// Internal method to render the template with the serialized data
		// and template helpers via the `Marionette.Renderer` object.
		// Throws an `UndefinedTemplateError` error if the template is
		// any falsely value but literal `false`.
		_renderTemplate: function() {
			var template = this.getTemplate();

			// Allow template-less item views
			if (template === false) {
				return;
			}

			if (!template) {
				throw new Marionette.Error({
					name: 'UndefinedTemplateError',
					message: 'Cannot render the template since it is null or undefined.'
				});
			}

			// Add in entity data and template helpers
			var data = this.mixinTemplateHelpers(this.serializeData());

			// Render and add to el
			var html = Marionette.Renderer.render(template, data, this);
			this.attachElContent(html);

			return this;
		},

		// Attaches the content of a given view.
		// This method can be overridden to optimize rendering,
		// or to render in a non standard way.
		//
		// For example, using `innerHTML` instead of `$el.html`
		//
		// ```js
		// attachElContent: function(html) {
		//   this.el.innerHTML = html;
		//   return this;
		// }
		// ```
		attachElContent: function(html) {
			this.$el.html(html);

			return this;
		}
	});

	/* jshint maxstatements: 14 */

	// Collection View
	// ---------------

	// A view that iterates over a Backbone.Collection
	// and renders an individual child view for each model.
	Marionette.CollectionView = Marionette.View.extend({

		// used as the prefix for child view events
		// that are forwarded through the collectionview
		childViewEventPrefix: 'childview',

		// flag for maintaining the sorted order of the collection
		sort: true,

		// constructor
		// option to pass `{sort: false}` to prevent the `CollectionView` from
		// maintaining the sorted order of the collection.
		// This will fallback onto appending childView's to the end.
		//
		// option to pass `{comparator: compFunction()}` to allow the `CollectionView`
		// to use a custom sort order for the collection.
		constructor: function(options) {

			this.once('render', this._initialEvents);
			this._initChildViewStorage();

			Marionette.View.apply(this, arguments);

			this.on('show', this._onShowCalled);

			this.initRenderBuffer();
		},

		// Instead of inserting elements one by one into the page,
		// it's much more performant to insert elements into a document
		// fragment and then insert that document fragment into the page
		initRenderBuffer: function() {
			this._bufferedChildren = [];
		},

		startBuffering: function() {
			this.initRenderBuffer();
			this.isBuffering = true;
		},

		endBuffering: function() {
			this.isBuffering = false;
			this._triggerBeforeShowBufferedChildren();

			this.attachBuffer(this);

			this._triggerShowBufferedChildren();
			this.initRenderBuffer();
		},

		_triggerBeforeShowBufferedChildren: function() {
			if (this._isShown) {
				_.each(this._bufferedChildren, _.partial(this._triggerMethodOnChild, 'before:show'));
			}
		},

		_triggerShowBufferedChildren: function() {
			if (this._isShown) {
				_.each(this._bufferedChildren, _.partial(this._triggerMethodOnChild, 'show'));

				this._bufferedChildren = [];
			}
		},

		// Internal method for _.each loops to call `Marionette.triggerMethodOn` on
		// a child view
		_triggerMethodOnChild: function(event, childView) {
			Marionette.triggerMethodOn(childView, event);
		},

		// Configured the initial events that the collection view
		// binds to.
		_initialEvents: function() {
			if (this.collection) {
				this.listenTo(this.collection, 'add', this._onCollectionAdd);
				this.listenTo(this.collection, 'remove', this._onCollectionRemove);
				this.listenTo(this.collection, 'reset', this.render);

				if (this.getOption('sort')) {
					this.listenTo(this.collection, 'sort', this._sortViews);
				}
			}
		},

		// Handle a child added to the collection
		_onCollectionAdd: function(child, collection, opts) {
			var index;
			if (opts.at !== undefined) {
				index = opts.at;
			} else {
				index = _.indexOf(this._filteredSortedModels(), child);
			}

			if (this._shouldAddChild(child, index)) {
				this.destroyEmptyView();
				var ChildView = this.getChildView(child);
				this.addChild(child, ChildView, index);
			}
		},

		// get the child view by model it holds, and remove it
		_onCollectionRemove: function(model) {
			var view = this.children.findByModel(model);
			this.removeChildView(view);
			this.checkEmpty();
		},

		_onShowCalled: function() {
			this.children.each(_.partial(this._triggerMethodOnChild, 'show'));
		},

		// Render children views. Override this method to
		// provide your own implementation of a render function for
		// the collection view.
		render: function() {
			this._ensureViewIsIntact();
			this.triggerMethod('before:render', this);
			this._renderChildren();
			this.isRendered = true;
			this.triggerMethod('render', this);
			return this;
		},

		// Reorder DOM after sorting. When your element's rendering
		// do not use their index, you can pass reorderOnSort: true
		// to only reorder the DOM after a sort instead of rendering
		// all the collectionView
		reorder: function() {
			var children = this.children;
			var models = this._filteredSortedModels();
			var modelsChanged = _.find(models, function(model) {
				return !children.findByModel(model);
			});

			// If the models we're displaying have changed due to filtering
			// We need to add and/or remove child views
			// So render as normal
			if (modelsChanged) {
				this.render();
			} else {
				// get the DOM nodes in the same order as the models
				var els = _.map(models, function(model) {
					return children.findByModel(model).el;
				});

				// since append moves elements that are already in the DOM,
				// appending the elements will effectively reorder them
				this.triggerMethod('before:reorder');
				this._appendReorderedChildren(els);
				this.triggerMethod('reorder');
			}
		},

		// Render view after sorting. Override this method to
		// change how the view renders after a `sort` on the collection.
		// An example of this would be to only `renderChildren` in a `CompositeView`
		// rather than the full view.
		resortView: function() {
			if (Marionette.getOption(this, 'reorderOnSort')) {
				this.reorder();
			} else {
				this.render();
			}
		},

		// Internal method. This checks for any changes in the order of the collection.
		// If the index of any view doesn't match, it will render.
		_sortViews: function() {
			var models = this._filteredSortedModels();

			// check for any changes in sort order of views
			var orderChanged = _.find(models, function(item, index) {
				var view = this.children.findByModel(item);
				return !view || view._index !== index;
			}, this);

			if (orderChanged) {
				this.resortView();
			}
		},

		// Internal reference to what index a `emptyView` is.
		_emptyViewIndex: -1,

		// Internal method. Separated so that CompositeView can append to the childViewContainer
		// if necessary
		_appendReorderedChildren: function(children) {
			this.$el.append(children);
		},

		// Internal method. Separated so that CompositeView can have
		// more control over events being triggered, around the rendering
		// process
		_renderChildren: function() {
			this.destroyEmptyView();
			this.destroyChildren();

			if (this.isEmpty(this.collection)) {
				this.showEmptyView();
			} else {
				this.triggerMethod('before:render:collection', this);
				this.startBuffering();
				this.showCollection();
				this.endBuffering();
				this.triggerMethod('render:collection', this);

				// If we have shown children and none have passed the filter, show the empty view
				if (this.children.isEmpty()) {
					this.showEmptyView();
				}
			}
		},

		// Internal method to loop through collection and show each child view.
		showCollection: function() {
			var ChildView;

			var models = this._filteredSortedModels();

			_.each(models, function(child, index) {
				ChildView = this.getChildView(child);
				this.addChild(child, ChildView, index);
			}, this);
		},

		// Allow the collection to be sorted by a custom view comparator
		_filteredSortedModels: function() {
			var models;
			var viewComparator = this.getViewComparator();

			if (viewComparator) {
				if (_.isString(viewComparator) || viewComparator.length === 1) {
					models = this.collection.sortBy(viewComparator, this);
				} else {
					models = _.clone(this.collection.models).sort(_.bind(viewComparator, this));
				}
			} else {
				models = this.collection.models;
			}

			// Filter after sorting in case the filter uses the index
			if (this.getOption('filter')) {
				models = _.filter(models, function(model, index) {
					return this._shouldAddChild(model, index);
				}, this);
			}

			return models;
		},

		// Internal method to show an empty view in place of
		// a collection of child views, when the collection is empty
		showEmptyView: function() {
			var EmptyView = this.getEmptyView();

			if (EmptyView && !this._showingEmptyView) {
				this.triggerMethod('before:render:empty');

				this._showingEmptyView = true;
				var model = new Backbone.Model();
				this.addEmptyView(model, EmptyView);

				this.triggerMethod('render:empty');
			}
		},

		// Internal method to destroy an existing emptyView instance
		// if one exists. Called when a collection view has been
		// rendered empty, and then a child is added to the collection.
		destroyEmptyView: function() {
			if (this._showingEmptyView) {
				this.triggerMethod('before:remove:empty');

				this.destroyChildren();
				delete this._showingEmptyView;

				this.triggerMethod('remove:empty');
			}
		},

		// Retrieve the empty view class
		getEmptyView: function() {
			return this.getOption('emptyView');
		},

		// Render and show the emptyView. Similar to addChild method
		// but "add:child" events are not fired, and the event from
		// emptyView are not forwarded
		addEmptyView: function(child, EmptyView) {

			// get the emptyViewOptions, falling back to childViewOptions
			var emptyViewOptions = this.getOption('emptyViewOptions') ||
				this.getOption('childViewOptions');

			if (_.isFunction(emptyViewOptions)) {
				emptyViewOptions = emptyViewOptions.call(this, child, this._emptyViewIndex);
			}

			// build the empty view
			var view = this.buildChildView(child, EmptyView, emptyViewOptions);

			view._parent = this;

			// Proxy emptyView events
			this.proxyChildEvents(view);

			// trigger the 'before:show' event on `view` if the collection view
			// has already been shown
			if (this._isShown) {
				Marionette.triggerMethodOn(view, 'before:show');
			}

			// Store the `emptyView` like a `childView` so we can properly
			// remove and/or close it later
			this.children.add(view);

			// Render it and show it
			this.renderChildView(view, this._emptyViewIndex);

			// call the 'show' method if the collection view
			// has already been shown
			if (this._isShown) {
				Marionette.triggerMethodOn(view, 'show');
			}
		},

		// Retrieve the `childView` class, either from `this.options.childView`
		// or from the `childView` in the object definition. The "options"
		// takes precedence.
		// This method receives the model that will be passed to the instance
		// created from this `childView`. Overriding methods may use the child
		// to determine what `childView` class to return.
		getChildView: function(child) {
			var childView = this.getOption('childView');

			if (!childView) {
				throw new Marionette.Error({
					name: 'NoChildViewError',
					message: 'A "childView" must be specified'
				});
			}

			return childView;
		},

		// Render the child's view and add it to the
		// HTML for the collection view at a given index.
		// This will also update the indices of later views in the collection
		// in order to keep the children in sync with the collection.
		addChild: function(child, ChildView, index) {
			var childViewOptions = this.getOption('childViewOptions');
			childViewOptions = Marionette._getValue(childViewOptions, this, [child, index]);

			var view = this.buildChildView(child, ChildView, childViewOptions);

			// increment indices of views after this one
			this._updateIndices(view, true, index);

			this._addChildView(view, index);

			view._parent = this;

			return view;
		},

		// Internal method. This decrements or increments the indices of views after the
		// added/removed view to keep in sync with the collection.
		_updateIndices: function(view, increment, index) {
			if (!this.getOption('sort')) {
				return;
			}

			if (increment) {
				// assign the index to the view
				view._index = index;
			}

			// update the indexes of views after this one
			this.children.each(function(laterView) {
				if (laterView._index >= view._index) {
					laterView._index += increment ? 1 : -1;
				}
			});
		},

		// Internal Method. Add the view to children and render it at
		// the given index.
		_addChildView: function(view, index) {
			// set up the child view event forwarding
			this.proxyChildEvents(view);

			this.triggerMethod('before:add:child', view);

			// trigger the 'before:show' event on `view` if the collection view
			// has already been shown
			if (this._isShown && !this.isBuffering) {
				Marionette.triggerMethodOn(view, 'before:show');
			}

			// Store the child view itself so we can properly
			// remove and/or destroy it later
			this.children.add(view);
			this.renderChildView(view, index);

			if (this._isShown && !this.isBuffering) {
				Marionette.triggerMethodOn(view, 'show');
			}

			this.triggerMethod('add:child', view);
		},

		// render the child view
		renderChildView: function(view, index) {
			view.render();
			this.attachHtml(this, view, index);
			return view;
		},

		// Build a `childView` for a model in the collection.
		buildChildView: function(child, ChildViewClass, childViewOptions) {
			var options = _.extend({ model: child }, childViewOptions);
			return new ChildViewClass(options);
		},

		// Remove the child view and destroy it.
		// This function also updates the indices of
		// later views in the collection in order to keep
		// the children in sync with the collection.
		removeChildView: function(view) {

			if (view) {
				this.triggerMethod('before:remove:child', view);

				// call 'destroy' or 'remove', depending on which is found
				if (view.destroy) {
					view.destroy();
				} else if (view.remove) {
					view.remove();
				}

				delete view._parent;
				this.stopListening(view);
				this.children.remove(view);
				this.triggerMethod('remove:child', view);

				// decrement the index of views after this one
				this._updateIndices(view, false);
			}

			return view;
		},

		// check if the collection is empty
		isEmpty: function() {
			return !this.collection || this.collection.length === 0;
		},

		// If empty, show the empty view
		checkEmpty: function() {
			if (this.isEmpty(this.collection)) {
				this.showEmptyView();
			}
		},

		// You might need to override this if you've overridden attachHtml
		attachBuffer: function(collectionView) {
			collectionView.$el.append(this._createBuffer(collectionView));
		},

		// Create a fragment buffer from the currently buffered children
		_createBuffer: function(collectionView) {
			var elBuffer = document.createDocumentFragment();
			_.each(collectionView._bufferedChildren, function(b) {
				elBuffer.appendChild(b.el);
			});
			return elBuffer;
		},

		// Append the HTML to the collection's `el`.
		// Override this method to do something other
		// than `.append`.
		attachHtml: function(collectionView, childView, index) {
			if (collectionView.isBuffering) {
				// buffering happens on reset events and initial renders
				// in order to reduce the number of inserts into the
				// document, which are expensive.
				collectionView._bufferedChildren.splice(index, 0, childView);
			} else {
				// If we've already rendered the main collection, append
				// the new child into the correct order if we need to. Otherwise
				// append to the end.
				if (!collectionView._insertBefore(childView, index)) {
					collectionView._insertAfter(childView);
				}
			}
		},

		// Internal method. Check whether we need to insert the view into
		// the correct position.
		_insertBefore: function(childView, index) {
			var currentView;
			var findPosition = this.getOption('sort') && (index < this.children.length - 1);
			if (findPosition) {
				// Find the view after this one
				currentView = this.children.find(function(view) {
					return view._index === index + 1;
				});
			}

			if (currentView) {
				currentView.$el.before(childView.el);
				return true;
			}

			return false;
		},

		// Internal method. Append a view to the end of the $el
		_insertAfter: function(childView) {
			this.$el.append(childView.el);
		},

		// Internal method to set up the `children` object for
		// storing all of the child views
		_initChildViewStorage: function() {
			this.children = new Backbone.ChildViewContainer();
		},

		// Handle cleanup and other destroying needs for the collection of views
		destroy: function() {
			if (this.isDestroyed) {
				return this;
			}

			this.triggerMethod('before:destroy:collection');
			this.destroyChildren();
			this.triggerMethod('destroy:collection');

			return Marionette.View.prototype.destroy.apply(this, arguments);
		},

		// Destroy the child views that this collection view
		// is holding on to, if any
		destroyChildren: function() {
			var childViews = this.children.map(_.identity);
			this.children.each(this.removeChildView, this);
			this.checkEmpty();
			return childViews;
		},

		// Return true if the given child should be shown
		// Return false otherwise
		// The filter will be passed (child, index, collection)
		// Where
		//  'child' is the given model
		//  'index' is the index of that model in the collection
		//  'collection' is the collection referenced by this CollectionView
		_shouldAddChild: function(child, index) {
			var filter = this.getOption('filter');
			return !_.isFunction(filter) || filter.call(this, child, index, this.collection);
		},

		// Set up the child view event forwarding. Uses a "childview:"
		// prefix in front of all forwarded events.
		proxyChildEvents: function(view) {
			var prefix = this.getOption('childViewEventPrefix');

			// Forward all child view events through the parent,
			// prepending "childview:" to the event name
			this.listenTo(view, 'all', function() {
				var args = _.toArray(arguments);
				var rootEvent = args[0];
				var childEvents = this.normalizeMethods(_.result(this, 'childEvents'));

				args[0] = prefix + ':' + rootEvent;
				args.splice(1, 0, view);

				// call collectionView childEvent if defined
				if (typeof childEvents !== 'undefined' && _.isFunction(childEvents[rootEvent])) {
					childEvents[rootEvent].apply(this, args.slice(1));
				}

				this.triggerMethod.apply(this, args);
			});
		},

		_getImmediateChildren: function() {
			return _.values(this.children._views);
		},

		getViewComparator: function() {
			return this.getOption('viewComparator');
		}
	});

	/* jshint maxstatements: 17, maxlen: 117 */

	// Composite View
	// --------------

	// Used for rendering a branch-leaf, hierarchical structure.
	// Extends directly from CollectionView and also renders an
	// a child view as `modelView`, for the top leaf
	Marionette.CompositeView = Marionette.CollectionView.extend({

		// Setting up the inheritance chain which allows changes to
		// Marionette.CollectionView.prototype.constructor which allows overriding
		// option to pass '{sort: false}' to prevent the CompositeView from
		// maintaining the sorted order of the collection.
		// This will fallback onto appending childView's to the end.
		constructor: function() {
			Marionette.CollectionView.apply(this, arguments);
		},

		// Configured the initial events that the composite view
		// binds to. Override this method to prevent the initial
		// events, or to add your own initial events.
		_initialEvents: function() {

			// Bind only after composite view is rendered to avoid adding child views
			// to nonexistent childViewContainer

			if (this.collection) {
				this.listenTo(this.collection, 'add', this._onCollectionAdd);
				this.listenTo(this.collection, 'remove', this._onCollectionRemove);
				this.listenTo(this.collection, 'reset', this._renderChildren);

				if (this.getOption('sort')) {
					this.listenTo(this.collection, 'sort', this._sortViews);
				}
			}
		},

		// Retrieve the `childView` to be used when rendering each of
		// the items in the collection. The default is to return
		// `this.childView` or Marionette.CompositeView if no `childView`
		// has been defined
		getChildView: function(child) {
			var childView = this.getOption('childView') || this.constructor;

			return childView;
		},

		// Serialize the model for the view.
		// You can override the `serializeData` method in your own view
		// definition, to provide custom serialization for your view's data.
		serializeData: function() {
			var data = {};

			if (this.model) {
				data = _.partial(this.serializeModel, this.model).apply(this, arguments);
			}

			return data;
		},

		// Renders the model and the collection.
		render: function() {
			this._ensureViewIsIntact();
			this._isRendering = true;
			this.resetChildViewContainer();

			this.triggerMethod('before:render', this);

			this._renderTemplate();
			this._renderChildren();

			this._isRendering = false;
			this.isRendered = true;
			this.triggerMethod('render', this);
			return this;
		},

		_renderChildren: function() {
			if (this.isRendered || this._isRendering) {
				Marionette.CollectionView.prototype._renderChildren.call(this);
			}
		},

		// Render the root template that the children
		// views are appended to
		_renderTemplate: function() {
			var data = {};
			data = this.serializeData();
			data = this.mixinTemplateHelpers(data);

			this.triggerMethod('before:render:template');

			var template = this.getTemplate();
			var html = Marionette.Renderer.render(template, data, this);
			this.attachElContent(html);

			// the ui bindings is done here and not at the end of render since they
			// will not be available until after the model is rendered, but should be
			// available before the collection is rendered.
			this.bindUIElements();
			this.triggerMethod('render:template');
		},

		// Attaches the content of the root.
		// This method can be overridden to optimize rendering,
		// or to render in a non standard way.
		//
		// For example, using `innerHTML` instead of `$el.html`
		//
		// ```js
		// attachElContent: function(html) {
		//   this.el.innerHTML = html;
		//   return this;
		// }
		// ```
		attachElContent: function(html) {
			this.$el.html(html);

			return this;
		},

		// You might need to override this if you've overridden attachHtml
		attachBuffer: function(compositeView) {
			var $container = this.getChildViewContainer(compositeView);
			$container.append(this._createBuffer(compositeView));
		},

		// Internal method. Append a view to the end of the $el.
		// Overidden from CollectionView to ensure view is appended to
		// childViewContainer
		_insertAfter: function(childView) {
			var $container = this.getChildViewContainer(this, childView);
			$container.append(childView.el);
		},

		// Internal method. Append reordered childView'.
		// Overidden from CollectionView to ensure reordered views
		// are appended to childViewContainer
		_appendReorderedChildren: function(children) {
			var $container = this.getChildViewContainer(this);
			$container.append(children);
		},

		// Internal method to ensure an `$childViewContainer` exists, for the
		// `attachHtml` method to use.
		getChildViewContainer: function(containerView, childView) {
			if ('$childViewContainer' in containerView) {
				return containerView.$childViewContainer;
			}

			var container;
			var childViewContainer = Marionette.getOption(containerView, 'childViewContainer');
			if (childViewContainer) {

				var selector = Marionette._getValue(childViewContainer, containerView);

				if (selector.charAt(0) === '@' && containerView.ui) {
					container = containerView.ui[selector.substr(4)];
				} else {
					container = containerView.$(selector);
				}

				if (container.length <= 0) {
					throw new Marionette.Error({
						name: 'ChildViewContainerMissingError',
						message: 'The specified "childViewContainer" was not found: ' + containerView.childViewContainer
					});
				}

			} else {
				container = containerView.$el;
			}

			containerView.$childViewContainer = container;
			return container;
		},

		// Internal method to reset the `$childViewContainer` on render
		resetChildViewContainer: function() {
			if (this.$childViewContainer) {
				delete this.$childViewContainer;
			}
		}
	});

	// Layout View
	// -----------

	// Used for managing application layoutViews, nested layoutViews and
	// multiple regions within an application or sub-application.
	//
	// A specialized view class that renders an area of HTML and then
	// attaches `Region` instances to the specified `regions`.
	// Used for composite view management and sub-application areas.
	Marionette.LayoutView = Marionette.ItemView.extend({
		regionClass: Marionette.Region,

		options: {
			destroyImmediate: false
		},

		// used as the prefix for child view events
		// that are forwarded through the layoutview
		childViewEventPrefix: 'childview',

		// Ensure the regions are available when the `initialize` method
		// is called.
		constructor: function(options) {
			options = options || {};

			this._firstRender = true;
			this._initializeRegions(options);

			Marionette.ItemView.call(this, options);
		},

		// LayoutView's render will use the existing region objects the
		// first time it is called. Subsequent calls will destroy the
		// views that the regions are showing and then reset the `el`
		// for the regions to the newly rendered DOM elements.
		render: function() {
			this._ensureViewIsIntact();

			if (this._firstRender) {
				// if this is the first render, don't do anything to
				// reset the regions
				this._firstRender = false;
			} else {
				// If this is not the first render call, then we need to
				// re-initialize the `el` for each region
				this._reInitializeRegions();
			}

			return Marionette.ItemView.prototype.render.apply(this, arguments);
		},

		// Handle destroying regions, and then destroy the view itself.
		destroy: function() {
			if (this.isDestroyed) {
				return this;
			}
			// #2134: remove parent element before destroying the child views, so
			// removing the child views doesn't retrigger repaints
			if (this.getOption('destroyImmediate') === true) {
				this.$el.remove();
			}
			this.regionManager.destroy();
			return Marionette.ItemView.prototype.destroy.apply(this, arguments);
		},

		showChildView: function(regionName, view) {
			return this.getRegion(regionName).show(view);
		},

		getChildView: function(regionName) {
			return this.getRegion(regionName).currentView;
		},

		// Add a single region, by name, to the layoutView
		addRegion: function(name, definition) {
			var regions = {};
			regions[name] = definition;
			return this._buildRegions(regions)[name];
		},

		// Add multiple regions as a {name: definition, name2: def2} object literal
		addRegions: function(regions) {
			this.regions = _.extend({}, this.regions, regions);
			return this._buildRegions(regions);
		},

		// Remove a single region from the LayoutView, by name
		removeRegion: function(name) {
			delete this.regions[name];
			return this.regionManager.removeRegion(name);
		},

		// Provides alternative access to regions
		// Accepts the region name
		// getRegion('main')
		getRegion: function(region) {
			return this.regionManager.get(region);
		},

		// Get all regions
		getRegions: function() {
			return this.regionManager.getRegions();
		},

		// internal method to build regions
		_buildRegions: function(regions) {
			var defaults = {
				regionClass: this.getOption('regionClass'),
				parentEl: _.partial(_.result, this, 'el')
			};

			return this.regionManager.addRegions(regions, defaults);
		},

		// Internal method to initialize the regions that have been defined in a
		// `regions` attribute on this layoutView.
		_initializeRegions: function(options) {
			var regions;
			this._initRegionManager();

			regions = Marionette._getValue(this.regions, this, [options]) || {};

			// Enable users to define `regions` as instance options.
			var regionOptions = this.getOption.call(options, 'regions');

			// enable region options to be a function
			regionOptions = Marionette._getValue(regionOptions, this, [options]);

			_.extend(regions, regionOptions);

			// Normalize region selectors hash to allow
			// a user to use the @ui. syntax.
			regions = this.normalizeUIValues(regions, ['selector', 'el']);

			this.addRegions(regions);
		},

		// Internal method to re-initialize all of the regions by updating the `el` that
		// they point to
		_reInitializeRegions: function() {
			this.regionManager.invoke('reset');
		},

		// Enable easy overriding of the default `RegionManager`
		// for customized region interactions and business specific
		// view logic for better control over single regions.
		getRegionManager: function() {
			return new Marionette.RegionManager();
		},

		// Internal method to initialize the region manager
		// and all regions in it
		_initRegionManager: function() {
			this.regionManager = this.getRegionManager();
			this.regionManager._parent = this;

			this.listenTo(this.regionManager, 'before:add:region', function(name) {
				this.triggerMethod('before:add:region', name);
			});

			this.listenTo(this.regionManager, 'add:region', function(name, region) {
				this[name] = region;
				this.triggerMethod('add:region', name, region);
			});

			this.listenTo(this.regionManager, 'before:remove:region', function(name) {
				this.triggerMethod('before:remove:region', name);
			});

			this.listenTo(this.regionManager, 'remove:region', function(name, region) {
				delete this[name];
				this.triggerMethod('remove:region', name, region);
			});
		},

		_getImmediateChildren: function() {
			return _.chain(this.regionManager.getRegions())
				.pluck('currentView')
				.compact()
				.value();
		}
	});


	// Behavior
	// --------

	// A Behavior is an isolated set of DOM /
	// user interactions that can be mixed into any View.
	// Behaviors allow you to blackbox View specific interactions
	// into portable logical chunks, keeping your views simple and your code DRY.

	Marionette.Behavior = Marionette.Object.extend({
		constructor: function(options, view) {
			// Setup reference to the view.
			// this comes in handle when a behavior
			// wants to directly talk up the chain
			// to the view.
			this.view = view;
			this.defaults = _.result(this, 'defaults') || {};
			this.options = _.extend({}, this.defaults, options);
			// Construct an internal UI hash using
			// the views UI hash and then the behaviors UI hash.
			// This allows the user to use UI hash elements
			// defined in the parent view as well as those
			// defined in the given behavior.
			this.ui = _.extend({}, _.result(view, 'ui'), _.result(this, 'ui'));

			Marionette.Object.apply(this, arguments);
		},

		// proxy behavior $ method to the view
		// this is useful for doing jquery DOM lookups
		// scoped to behaviors view.
		$: function() {
			return this.view.$.apply(this.view, arguments);
		},

		// Stops the behavior from listening to events.
		// Overrides Object#destroy to prevent additional events from being triggered.
		destroy: function() {
			this.stopListening();

			return this;
		},

		proxyViewProperties: function(view) {
			this.$el = view.$el;
			this.el = view.el;
		}
	});

	/* jshint maxlen: 143 */
	// Behaviors
	// ---------

	// Behaviors is a utility class that takes care of
	// gluing your behavior instances to their given View.
	// The most important part of this class is that you
	// **MUST** override the class level behaviorsLookup
	// method for things to work properly.

	Marionette.Behaviors = (function(Marionette, _) {
		// Borrow event splitter from Backbone
		var delegateEventSplitter = /^(\S+)\s*(.*)$/;

		function Behaviors(view, behaviors) {

			if (!_.isObject(view.behaviors)) {
				return {};
			}

			// Behaviors defined on a view can be a flat object literal
			// or it can be a function that returns an object.
			behaviors = Behaviors.parseBehaviors(view, behaviors || _.result(view, 'behaviors'));

			// Wraps several of the view's methods
			// calling the methods first on each behavior
			// and then eventually calling the method on the view.
			Behaviors.wrap(view, behaviors, _.keys(methods));
			return behaviors;
		}

		var methods = {
			behaviorTriggers: function(behaviorTriggers, behaviors) {
				var triggerBuilder = new BehaviorTriggersBuilder(this, behaviors);
				return triggerBuilder.buildBehaviorTriggers();
			},

			behaviorEvents: function(behaviorEvents, behaviors) {
				var _behaviorsEvents = {};

				_.each(behaviors, function(b, i) {
					var _events = {};
					var behaviorEvents = _.clone(_.result(b, 'events')) || {};

					// Normalize behavior events hash to allow
					// a user to use the @ui. syntax.
					behaviorEvents = Marionette.normalizeUIKeys(behaviorEvents, getBehaviorsUI(b));

					var j = 0;
					_.each(behaviorEvents, function(behaviour, key) {
						var match = key.match(delegateEventSplitter);

						// Set event name to be namespaced using the view cid,
						// the behavior index, and the behavior event index
						// to generate a non colliding event namespace
						// http://api.jquery.com/event.namespace/
						var eventName = match[1] + '.' + [this.cid, i, j++, ' '].join('');
						var selector = match[2];

						var eventKey = eventName + selector;
						var handler = _.isFunction(behaviour) ? behaviour : b[behaviour];

						_events[eventKey] = _.bind(handler, b);
					}, this);

					_behaviorsEvents = _.extend(_behaviorsEvents, _events);
				}, this);

				return _behaviorsEvents;
			}
		};

		_.extend(Behaviors, {

			// Placeholder method to be extended by the user.
			// The method should define the object that stores the behaviors.
			// i.e.
			//
			// ```js
			// Marionette.Behaviors.behaviorsLookup: function() {
			//   return App.Behaviors
			// }
			// ```
			behaviorsLookup: function() {
				throw new Marionette.Error({
					message: 'You must define where your behaviors are stored.',
					url: 'marionette.behaviors.html#behaviorslookup'
				});
			},

			// Takes care of getting the behavior class
			// given options and a key.
			// If a user passes in options.behaviorClass
			// default to using that. Otherwise delegate
			// the lookup to the users `behaviorsLookup` implementation.
			getBehaviorClass: function(options, key) {
				if (options.behaviorClass) {
					return options.behaviorClass;
				}

				// Get behavior class can be either a flat object or a method
				return Marionette._getValue(Behaviors.behaviorsLookup, this, [options, key])[key];
			},

			// Iterate over the behaviors object, for each behavior
			// instantiate it and get its grouped behaviors.
			parseBehaviors: function(view, behaviors) {
				return _.chain(behaviors).map(function(options, key) {
					var BehaviorClass = Behaviors.getBehaviorClass(options, key);

					var behavior = new BehaviorClass(options, view);
					var nestedBehaviors = Behaviors.parseBehaviors(view, _.result(behavior, 'behaviors'));

					return [behavior].concat(nestedBehaviors);
				}).flatten().value();
			},

			// Wrap view internal methods so that they delegate to behaviors. For example,
			// `onDestroy` should trigger destroy on all of the behaviors and then destroy itself.
			// i.e.
			//
			// `view.delegateEvents = _.partial(methods.delegateEvents, view.delegateEvents, behaviors);`
			wrap: function(view, behaviors, methodNames) {
				_.each(methodNames, function(methodName) {
					view[methodName] = _.partial(methods[methodName], view[methodName], behaviors);
				});
			}
		});

		// Class to build handlers for `triggers` on behaviors
		// for views
		function BehaviorTriggersBuilder(view, behaviors) {
			this._view = view;
			this._behaviors = behaviors;
			this._triggers = {};
		}

		_.extend(BehaviorTriggersBuilder.prototype, {
			// Main method to build the triggers hash with event keys and handlers
			buildBehaviorTriggers: function() {
				_.each(this._behaviors, this._buildTriggerHandlersForBehavior, this);
				return this._triggers;
			},

			// Internal method to build all trigger handlers for a given behavior
			_buildTriggerHandlersForBehavior: function(behavior, i) {
				var triggersHash = _.clone(_.result(behavior, 'triggers')) || {};

				triggersHash = Marionette.normalizeUIKeys(triggersHash, getBehaviorsUI(behavior));

				_.each(triggersHash, _.bind(this._setHandlerForBehavior, this, behavior, i));
			},

			// Internal method to create and assign the trigger handler for a given
			// behavior
			_setHandlerForBehavior: function(behavior, i, eventName, trigger) {
				// Unique identifier for the `this._triggers` hash
				var triggerKey = trigger.replace(/^\S+/, function(triggerName) {
					return triggerName + '.' + 'behaviortriggers' + i;
				});

				this._triggers[triggerKey] = this._view._buildViewTrigger(eventName);
			}
		});

		function getBehaviorsUI(behavior) {
			return behavior._uiBindings || behavior.ui;
		}

		return Behaviors;

	})(Marionette, _);


	// App Router
	// ----------

	// Reduce the boilerplate code of handling route events
	// and then calling a single method on another object.
	// Have your routers configured to call the method on
	// your object, directly.
	//
	// Configure an AppRouter with `appRoutes`.
	//
	// App routers can only take one `controller` object.
	// It is recommended that you divide your controller
	// objects in to smaller pieces of related functionality
	// and have multiple routers / controllers, instead of
	// just one giant router and controller.
	//
	// You can also add standard routes to an AppRouter.

	Marionette.AppRouter = Backbone.Router.extend({
		constructor: function(options) {
			this.options = options || {};

			Backbone.Router.apply(this, arguments);

			var appRoutes = this.getOption('appRoutes');
			var controller = this._getController();
			this.processAppRoutes(controller, appRoutes);
			this.on('route', this._processOnRoute, this);
		},

		// Similar to route method on a Backbone Router but
		// method is called on the controller
		appRoute: function(route, methodName) {
			var controller = this._getController();
			this._addAppRoute(controller, route, methodName);
		},

		// process the route event and trigger the onRoute
		// method call, if it exists
		_processOnRoute: function(routeName, routeArgs) {
			// make sure an onRoute before trying to call it
			if (_.isFunction(this.onRoute)) {
				// find the path that matches the current route
				var routePath = _.invert(this.getOption('appRoutes'))[routeName];
				this.onRoute(routeName, routePath, routeArgs);
			}
		},

		// Internal method to process the `appRoutes` for the
		// router, and turn them in to routes that trigger the
		// specified method on the specified `controller`.
		processAppRoutes: function(controller, appRoutes) {
			if (!appRoutes) {
				return;
			}

			var routeNames = _.keys(appRoutes).reverse(); // Backbone requires reverted order of routes

			_.each(routeNames, function(route) {
				this._addAppRoute(controller, route, appRoutes[route]);
			}, this);
		},

		_getController: function() {
			return this.getOption('controller');
		},

		_addAppRoute: function(controller, route, methodName) {
			var method = controller[methodName];

			if (!method) {
				throw new Marionette.Error('Method "' + methodName + '" was not found on the controller');
			}

			this.route(route, methodName, _.bind(method, controller));
		},

		mergeOptions: Marionette.mergeOptions,

		// Proxy `getOption` to enable getting options from this or this.options by name.
		getOption: Marionette.proxyGetOption,

		triggerMethod: Marionette.triggerMethod,

		bindEntityEvents: Marionette.proxyBindEntityEvents,

		unbindEntityEvents: Marionette.proxyUnbindEntityEvents
	});

	// Application
	// -----------

	// Contain and manage the composite application as a whole.
	// Stores and starts up `Region` objects, includes an
	// event aggregator as `app.vent`
	Marionette.Application = Marionette.Object.extend({
		constructor: function(options) {
			this._initializeRegions(options);
			this._initCallbacks = new Marionette.Callbacks();
			this.submodules = {};
			_.extend(this, options);
			this._initChannel();
			Marionette.Object.call(this, options);
		},

		// Command execution, facilitated by Backbone.Wreqr.Commands
		execute: function() {
			this.commands.execute.apply(this.commands, arguments);
		},

		// Request/response, facilitated by Backbone.Wreqr.RequestResponse
		request: function() {
			return this.reqres.request.apply(this.reqres, arguments);
		},

		// Add an initializer that is either run at when the `start`
		// method is called, or run immediately if added after `start`
		// has already been called.
		addInitializer: function(initializer) {
			this._initCallbacks.add(initializer);
		},

		// kick off all of the application's processes.
		// initializes all of the regions that have been added
		// to the app, and runs all of the initializer functions
		start: function(options) {
			this.triggerMethod('before:start', options);
			this._initCallbacks.run(options, this);
			this.triggerMethod('start', options);
		},

		// Add regions to your app.
		// Accepts a hash of named strings or Region objects
		// addRegions({something: "#someRegion"})
		// addRegions({something: Region.extend({el: "#someRegion"}) });
		addRegions: function(regions) {
			return this._regionManager.addRegions(regions);
		},

		// Empty all regions in the app, without removing them
		emptyRegions: function() {
			return this._regionManager.emptyRegions();
		},

		// Removes a region from your app, by name
		// Accepts the regions name
		// removeRegion('myRegion')
		removeRegion: function(region) {
			return this._regionManager.removeRegion(region);
		},

		// Provides alternative access to regions
		// Accepts the region name
		// getRegion('main')
		getRegion: function(region) {
			return this._regionManager.get(region);
		},

		// Get all the regions from the region manager
		getRegions: function() {
			return this._regionManager.getRegions();
		},

		// Create a module, attached to the application
		module: function(moduleNames, moduleDefinition) {

			// Overwrite the module class if the user specifies one
			var ModuleClass = Marionette.Module.getClass(moduleDefinition);

			var args = _.toArray(arguments);
			args.unshift(this);

			// see the Marionette.Module object for more information
			return ModuleClass.create.apply(ModuleClass, args);
		},

		// Enable easy overriding of the default `RegionManager`
		// for customized region interactions and business-specific
		// view logic for better control over single regions.
		getRegionManager: function() {
			return new Marionette.RegionManager();
		},

		// Internal method to initialize the regions that have been defined in a
		// `regions` attribute on the application instance
		_initializeRegions: function(options) {
			var regions = _.isFunction(this.regions) ? this.regions(options) : this.regions || {};

			this._initRegionManager();

			// Enable users to define `regions` in instance options.
			var optionRegions = Marionette.getOption(options, 'regions');

			// Enable region options to be a function
			if (_.isFunction(optionRegions)) {
				optionRegions = optionRegions.call(this, options);
			}

			// Overwrite current regions with those passed in options
			_.extend(regions, optionRegions);

			this.addRegions(regions);

			return this;
		},

		// Internal method to set up the region manager
		_initRegionManager: function() {
			this._regionManager = this.getRegionManager();
			this._regionManager._parent = this;

			this.listenTo(this._regionManager, 'before:add:region', function() {
				Marionette._triggerMethod(this, 'before:add:region', arguments);
			});

			this.listenTo(this._regionManager, 'add:region', function(name, region) {
				this[name] = region;
				Marionette._triggerMethod(this, 'add:region', arguments);
			});

			this.listenTo(this._regionManager, 'before:remove:region', function() {
				Marionette._triggerMethod(this, 'before:remove:region', arguments);
			});

			this.listenTo(this._regionManager, 'remove:region', function(name) {
				delete this[name];
				Marionette._triggerMethod(this, 'remove:region', arguments);
			});
		},

		// Internal method to setup the Wreqr.radio channel
		_initChannel: function() {
			this.channelName = _.result(this, 'channelName') || 'global';
			this.channel = _.result(this, 'channel') || Backbone.Wreqr.radio.channel(this.channelName);
			this.vent = _.result(this, 'vent') || this.channel.vent;
			this.commands = _.result(this, 'commands') || this.channel.commands;
			this.reqres = _.result(this, 'reqres') || this.channel.reqres;
		}
	});

	/* jshint maxparams: 9 */

	// Module
	// ------

	// A simple module system, used to create privacy and encapsulation in
	// Marionette applications
	Marionette.Module = function(moduleName, app, options) {
		this.moduleName = moduleName;
		this.options = _.extend({}, this.options, options);
		// Allow for a user to overide the initialize
		// for a given module instance.
		this.initialize = options.initialize || this.initialize;

		// Set up an internal store for sub-modules.
		this.submodules = {};

		this._setupInitializersAndFinalizers();

		// Set an internal reference to the app
		// within a module.
		this.app = app;

		if (_.isFunction(this.initialize)) {
			this.initialize(moduleName, app, this.options);
		}
	};

	Marionette.Module.extend = Marionette.extend;

	// Extend the Module prototype with events / listenTo, so that the module
	// can be used as an event aggregator or pub/sub.
	_.extend(Marionette.Module.prototype, Backbone.Events, {

		// By default modules start with their parents.
		startWithParent: true,

		// Initialize is an empty function by default. Override it with your own
		// initialization logic when extending Marionette.Module.
		initialize: function() {},

		// Initializer for a specific module. Initializers are run when the
		// module's `start` method is called.
		addInitializer: function(callback) {
			this._initializerCallbacks.add(callback);
		},

		// Finalizers are run when a module is stopped. They are used to teardown
		// and finalize any variables, references, events and other code that the
		// module had set up.
		addFinalizer: function(callback) {
			this._finalizerCallbacks.add(callback);
		},

		// Start the module, and run all of its initializers
		start: function(options) {
			// Prevent re-starting a module that is already started
			if (this._isInitialized) {
				return;
			}

			// start the sub-modules (depth-first hierarchy)
			_.each(this.submodules, function(mod) {
				// check to see if we should start the sub-module with this parent
				if (mod.startWithParent) {
					mod.start(options);
				}
			});

			// run the callbacks to "start" the current module
			this.triggerMethod('before:start', options);

			this._initializerCallbacks.run(options, this);
			this._isInitialized = true;

			this.triggerMethod('start', options);
		},

		// Stop this module by running its finalizers and then stop all of
		// the sub-modules for this module
		stop: function() {
			// if we are not initialized, don't bother finalizing
			if (!this._isInitialized) {
				return;
			}
			this._isInitialized = false;

			this.triggerMethod('before:stop');

			// stop the sub-modules; depth-first, to make sure the
			// sub-modules are stopped / finalized before parents
			_.invoke(this.submodules, 'stop');

			// run the finalizers
			this._finalizerCallbacks.run(undefined, this);

			// reset the initializers and finalizers
			this._initializerCallbacks.reset();
			this._finalizerCallbacks.reset();

			this.triggerMethod('stop');
		},

		// Configure the module with a definition function and any custom args
		// that are to be passed in to the definition function
		addDefinition: function(moduleDefinition, customArgs) {
			this._runModuleDefinition(moduleDefinition, customArgs);
		},

		// Internal method: run the module definition function with the correct
		// arguments
		_runModuleDefinition: function(definition, customArgs) {
			// If there is no definition short circut the method.
			if (!definition) {
				return;
			}

			// build the correct list of arguments for the module definition
			var args = _.flatten([
				this,
				this.app,
				Backbone,
				Marionette,
				Backbone.$, _,
				customArgs
			]);

			definition.apply(this, args);
		},

		// Internal method: set up new copies of initializers and finalizers.
		// Calling this method will wipe out all existing initializers and
		// finalizers.
		_setupInitializersAndFinalizers: function() {
			this._initializerCallbacks = new Marionette.Callbacks();
			this._finalizerCallbacks = new Marionette.Callbacks();
		},

		// import the `triggerMethod` to trigger events with corresponding
		// methods if the method exists
		triggerMethod: Marionette.triggerMethod
	});

	// Class methods to create modules
	_.extend(Marionette.Module, {

		// Create a module, hanging off the app parameter as the parent object.
		create: function(app, moduleNames, moduleDefinition) {
			var module = app;

			// get the custom args passed in after the module definition and
			// get rid of the module name and definition function
			var customArgs = _.drop(arguments, 3);

			// Split the module names and get the number of submodules.
			// i.e. an example module name of `Doge.Wow.Amaze` would
			// then have the potential for 3 module definitions.
			moduleNames = moduleNames.split('.');
			var length = moduleNames.length;

			// store the module definition for the last module in the chain
			var moduleDefinitions = [];
			moduleDefinitions[length - 1] = moduleDefinition;

			// Loop through all the parts of the module definition
			_.each(moduleNames, function(moduleName, i) {
				var parentModule = module;
				module = this._getModule(parentModule, moduleName, app, moduleDefinition);
				this._addModuleDefinition(parentModule, module, moduleDefinitions[i], customArgs);
			}, this);

			// Return the last module in the definition chain
			return module;
		},

		_getModule: function(parentModule, moduleName, app, def, args) {
			var options = _.extend({}, def);
			var ModuleClass = this.getClass(def);

			// Get an existing module of this name if we have one
			var module = parentModule[moduleName];

			if (!module) {
				// Create a new module if we don't have one
				module = new ModuleClass(moduleName, app, options);
				parentModule[moduleName] = module;
				// store the module on the parent
				parentModule.submodules[moduleName] = module;
			}

			return module;
		},

		// ## Module Classes
		//
		// Module classes can be used as an alternative to the define pattern.
		// The extend function of a Module is identical to the extend functions
		// on other Backbone and Marionette classes.
		// This allows module lifecyle events like `onStart` and `onStop` to be called directly.
		getClass: function(moduleDefinition) {
			var ModuleClass = Marionette.Module;

			if (!moduleDefinition) {
				return ModuleClass;
			}

			// If all of the module's functionality is defined inside its class,
			// then the class can be passed in directly. `MyApp.module("Foo", FooModule)`.
			if (moduleDefinition.prototype instanceof ModuleClass) {
				return moduleDefinition;
			}

			return moduleDefinition.moduleClass || ModuleClass;
		},

		// Add the module definition and add a startWithParent initializer function.
		// This is complicated because module definitions are heavily overloaded
		// and support an anonymous function, module class, or options object
		_addModuleDefinition: function(parentModule, module, def, args) {
			var fn = this._getDefine(def);
			var startWithParent = this._getStartWithParent(def, module);

			if (fn) {
				module.addDefinition(fn, args);
			}

			this._addStartWithParent(parentModule, module, startWithParent);
		},

		_getStartWithParent: function(def, module) {
			var swp;

			if (_.isFunction(def) && (def.prototype instanceof Marionette.Module)) {
				swp = module.constructor.prototype.startWithParent;
				return _.isUndefined(swp) ? true : swp;
			}

			if (_.isObject(def)) {
				swp = def.startWithParent;
				return _.isUndefined(swp) ? true : swp;
			}

			return true;
		},

		_getDefine: function(def) {
			if (_.isFunction(def) && !(def.prototype instanceof Marionette.Module)) {
				return def;
			}

			if (_.isObject(def)) {
				return def.define;
			}

			return null;
		},

		_addStartWithParent: function(parentModule, module, startWithParent) {
			module.startWithParent = module.startWithParent && startWithParent;

			if (!module.startWithParent || !!module.startWithParentIsConfigured) {
				return;
			}

			module.startWithParentIsConfigured = true;

			parentModule.addInitializer(function(options) {
				if (module.startWithParent) {
					module.start(options);
				}
			});
		}
	});


	return Marionette;
}));
/*!
 * Autolinker.js
 * 0.26.0
 *
 * Copyright(c) 2016 Gregory Jacobs <greg@greg-jacobs.com>
 * MIT License
 *
 * https://github.com/gregjacobs/Autolinker.js
 */
;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Autolinker = factory();
  }
}(this, function() {
/**
 * @class Autolinker
 * @extends Object
 *
 * Utility class used to process a given string of text, and wrap the matches in
 * the appropriate anchor (&lt;a&gt;) tags to turn them into links.
 *
 * Any of the configuration options may be provided in an Object (map) provided
 * to the Autolinker constructor, which will configure how the {@link #link link()}
 * method will process the links.
 *
 * For example:
 *
 *     var autolinker = new Autolinker( {
 *         newWindow : false,
 *         truncate  : 30
 *     } );
 *
 *     var html = autolinker.link( "Joe went to www.yahoo.com" );
 *     // produces: 'Joe went to <a href="http://www.yahoo.com">yahoo.com</a>'
 *
 *
 * The {@link #static-link static link()} method may also be used to inline
 * options into a single call, which may be more convenient for one-off uses.
 * For example:
 *
 *     var html = Autolinker.link( "Joe went to www.yahoo.com", {
 *         newWindow : false,
 *         truncate  : 30
 *     } );
 *     // produces: 'Joe went to <a href="http://www.yahoo.com">yahoo.com</a>'
 *
 *
 * ## Custom Replacements of Links
 *
 * If the configuration options do not provide enough flexibility, a {@link #replaceFn}
 * may be provided to fully customize the output of Autolinker. This function is
 * called once for each URL/Email/Phone#/Twitter Handle/Hashtag match that is
 * encountered.
 *
 * For example:
 *
 *     var input = "...";  // string with URLs, Email Addresses, Phone #s, Twitter Handles, and Hashtags
 *
 *     var linkedText = Autolinker.link( input, {
 *         replaceFn : function( autolinker, match ) {
 *             console.log( "href = ", match.getAnchorHref() );
 *             console.log( "text = ", match.getAnchorText() );
 *
 *             switch( match.getType() ) {
 *                 case 'url' :
 *                     console.log( "url: ", match.getUrl() );
 *
 *                     if( match.getUrl().indexOf( 'mysite.com' ) === -1 ) {
 *                         var tag = autolinker.getTagBuilder().build( match );  // returns an `Autolinker.HtmlTag` instance, which provides mutator methods for easy changes
 *                         tag.setAttr( 'rel', 'nofollow' );
 *                         tag.addClass( 'external-link' );
 *
 *                         return tag;
 *
 *                     } else {
 *                         return true;  // let Autolinker perform its normal anchor tag replacement
 *                     }
 *
 *                 case 'email' :
 *                     var email = match.getEmail();
 *                     console.log( "email: ", email );
 *
 *                     if( email === "my@own.address" ) {
 *                         return false;  // don't auto-link this particular email address; leave as-is
 *                     } else {
 *                         return;  // no return value will have Autolinker perform its normal anchor tag replacement (same as returning `true`)
 *                     }
 *
 *                 case 'phone' :
 *                     var phoneNumber = match.getPhoneNumber();
 *                     console.log( phoneNumber );
 *
 *                     return '<a href="http://newplace.to.link.phone.numbers.to/">' + phoneNumber + '</a>';
 *
 *                 case 'twitter' :
 *                     var twitterHandle = match.getTwitterHandle();
 *                     console.log( twitterHandle );
 *
 *                     return '<a href="http://newplace.to.link.twitter.handles.to/">' + twitterHandle + '</a>';
 *
 *                 case 'hashtag' :
 *                     var hashtag = match.getHashtag();
 *                     console.log( hashtag );
 *
 *                     return '<a href="http://newplace.to.link.hashtag.handles.to/">' + hashtag + '</a>';
 *             }
 *         }
 *     } );
 *
 *
 * The function may return the following values:
 *
 * - `true` (Boolean): Allow Autolinker to replace the match as it normally
 *   would.
 * - `false` (Boolean): Do not replace the current match at all - leave as-is.
 * - Any String: If a string is returned from the function, the string will be
 *   used directly as the replacement HTML for the match.
 * - An {@link Autolinker.HtmlTag} instance, which can be used to build/modify
 *   an HTML tag before writing out its HTML text.
 *
 * @constructor
 * @param {Object} [cfg] The configuration options for the Autolinker instance,
 *   specified in an Object (map).
 */
var Autolinker = function( cfg ) {
	cfg = cfg || {};

	this.version = Autolinker.version;

	this.urls = this.normalizeUrlsCfg( cfg.urls );
	this.email = typeof cfg.email === 'boolean' ? cfg.email : true;
	this.twitter = typeof cfg.twitter === 'boolean' ? cfg.twitter : true;
	this.phone = typeof cfg.phone === 'boolean' ? cfg.phone : true;
	this.hashtag = cfg.hashtag || false;
	this.newWindow = typeof cfg.newWindow === 'boolean' ? cfg.newWindow : true;
	this.stripPrefix = typeof cfg.stripPrefix === 'boolean' ? cfg.stripPrefix : true;

	// Validate the value of the `hashtag` cfg.
	var hashtag = this.hashtag;
	if( hashtag !== false && hashtag !== 'twitter' && hashtag !== 'facebook' && hashtag !== 'instagram' ) {
		throw new Error( "invalid `hashtag` cfg - see docs" );
	}

	this.truncate = this.normalizeTruncateCfg( cfg.truncate );
	this.className = cfg.className || '';
	this.replaceFn = cfg.replaceFn || null;

	this.htmlParser = null;
	this.matchers = null;
	this.tagBuilder = null;
};



/**
 * Automatically links URLs, Email addresses, Phone Numbers, Twitter handles,
 * and Hashtags found in the given chunk of HTML. Does not link URLs found
 * within HTML tags.
 *
 * For instance, if given the text: `You should go to http://www.yahoo.com`,
 * then the result will be `You should go to &lt;a href="http://www.yahoo.com"&gt;http://www.yahoo.com&lt;/a&gt;`
 *
 * Example:
 *
 *     var linkedText = Autolinker.link( "Go to google.com", { newWindow: false } );
 *     // Produces: "Go to <a href="http://google.com">google.com</a>"
 *
 * @static
 * @param {String} textOrHtml The HTML or text to find matches within (depending
 *   on if the {@link #urls}, {@link #email}, {@link #phone}, {@link #twitter},
 *   and {@link #hashtag} options are enabled).
 * @param {Object} [options] Any of the configuration options for the Autolinker
 *   class, specified in an Object (map). See the class description for an
 *   example call.
 * @return {String} The HTML text, with matches automatically linked.
 */
Autolinker.link = function( textOrHtml, options ) {
	var autolinker = new Autolinker( options );
	return autolinker.link( textOrHtml );
};


/**
 * @static
 * @property {String} version (readonly)
 *
 * The Autolinker version number in the form major.minor.patch
 *
 * Ex: 0.25.1
 */
Autolinker.version = '0.26.0';


Autolinker.prototype = {
	constructor : Autolinker,  // fix constructor property

	/**
	 * @cfg {Boolean/Object} [urls=true]
	 *
	 * `true` if URLs should be automatically linked, `false` if they should not
	 * be.
	 *
	 * This option also accepts an Object form with 3 properties, to allow for
	 * more customization of what exactly gets linked. All default to `true`:
	 *
	 * @param {Boolean} schemeMatches `true` to match URLs found prefixed with a
	 *   scheme, i.e. `http://google.com`, or `other+scheme://google.com`,
	 *   `false` to prevent these types of matches.
	 * @param {Boolean} wwwMatches `true` to match urls found prefixed with
	 *   `'www.'`, i.e. `www.google.com`. `false` to prevent these types of
	 *   matches. Note that if the URL had a prefixed scheme, and
	 *   `schemeMatches` is true, it will still be linked.
	 * @param {Boolean} tldMatches `true` to match URLs with known top level
	 *   domains (.com, .net, etc.) that are not prefixed with a scheme or
	 *   `'www.'`. This option attempts to match anything that looks like a URL
	 *   in the given text. Ex: `google.com`, `asdf.org/?page=1`, etc. `false`
	 *   to prevent these types of matches.
	 */

	/**
	 * @cfg {Boolean} [email=true]
	 *
	 * `true` if email addresses should be automatically linked, `false` if they
	 * should not be.
	 */

	/**
	 * @cfg {Boolean} [twitter=true]
	 *
	 * `true` if Twitter handles ("@example") should be automatically linked,
	 * `false` if they should not be.
	 */

	/**
	 * @cfg {Boolean} [phone=true]
	 *
	 * `true` if Phone numbers ("(555)555-5555") should be automatically linked,
	 * `false` if they should not be.
	 */

	/**
	 * @cfg {Boolean/String} [hashtag=false]
	 *
	 * A string for the service name to have hashtags (ex: "#myHashtag")
	 * auto-linked to. The currently-supported values are:
	 *
	 * - 'twitter'
	 * - 'facebook'
	 * - 'instagram'
	 *
	 * Pass `false` to skip auto-linking of hashtags.
	 */

	/**
	 * @cfg {Boolean} [newWindow=true]
	 *
	 * `true` if the links should open in a new window, `false` otherwise.
	 */

	/**
	 * @cfg {Boolean} [stripPrefix=true]
	 *
	 * `true` if 'http://' or 'https://' and/or the 'www.' should be stripped
	 * from the beginning of URL links' text, `false` otherwise.
	 */

	/**
	 * @cfg {Number/Object} [truncate=0]
	 *
	 * ## Number Form
	 *
	 * A number for how many characters matched text should be truncated to
	 * inside the text of a link. If the matched text is over this number of
	 * characters, it will be truncated to this length by adding a two period
	 * ellipsis ('..') to the end of the string.
	 *
	 * For example: A url like 'http://www.yahoo.com/some/long/path/to/a/file'
	 * truncated to 25 characters might look something like this:
	 * 'yahoo.com/some/long/pat..'
	 *
	 * Example Usage:
	 *
	 *     truncate: 25
	 *
	 *
	 *  Defaults to `0` for "no truncation."
	 *
	 *
	 * ## Object Form
	 *
	 * An Object may also be provided with two properties: `length` (Number) and
	 * `location` (String). `location` may be one of the following: 'end'
	 * (default), 'middle', or 'smart'.
	 *
	 * Example Usage:
	 *
	 *     truncate: { length: 25, location: 'middle' }
	 *
	 * @cfg {Number} [truncate.length=0] How many characters to allow before
	 *   truncation will occur. Defaults to `0` for "no truncation."
	 * @cfg {"end"/"middle"/"smart"} [truncate.location="end"]
	 *
	 * - 'end' (default): will truncate up to the number of characters, and then
	 *   add an ellipsis at the end. Ex: 'yahoo.com/some/long/pat..'
	 * - 'middle': will truncate and add the ellipsis in the middle. Ex:
	 *   'yahoo.com/s..th/to/a/file'
	 * - 'smart': for URLs where the algorithm attempts to strip out unnecessary
	 *   parts first (such as the 'www.', then URL scheme, hash, etc.),
	 *   attempting to make the URL human-readable before looking for a good
	 *   point to insert the ellipsis if it is still too long. Ex:
	 *   'yahoo.com/some..to/a/file'. For more details, see
	 *   {@link Autolinker.truncate.TruncateSmart}.
	 */

	/**
	 * @cfg {String} className
	 *
	 * A CSS class name to add to the generated links. This class will be added
	 * to all links, as well as this class plus match suffixes for styling
	 * url/email/phone/twitter/hashtag links differently.
	 *
	 * For example, if this config is provided as "myLink", then:
	 *
	 * - URL links will have the CSS classes: "myLink myLink-url"
	 * - Email links will have the CSS classes: "myLink myLink-email", and
	 * - Twitter links will have the CSS classes: "myLink myLink-twitter"
	 * - Phone links will have the CSS classes: "myLink myLink-phone"
	 * - Hashtag links will have the CSS classes: "myLink myLink-hashtag"
	 */

	/**
	 * @cfg {Function} replaceFn
	 *
	 * A function to individually process each match found in the input string.
	 *
	 * See the class's description for usage.
	 *
	 * This function is called with the following parameters:
	 *
	 * @cfg {Autolinker} replaceFn.autolinker The Autolinker instance, which may
	 *   be used to retrieve child objects from (such as the instance's
	 *   {@link #getTagBuilder tag builder}).
	 * @cfg {Autolinker.match.Match} replaceFn.match The Match instance which
	 *   can be used to retrieve information about the match that the `replaceFn`
	 *   is currently processing. See {@link Autolinker.match.Match} subclasses
	 *   for details.
	 */


	/**
	 * @property {String} version (readonly)
	 *
	 * The Autolinker version number in the form major.minor.patch
	 *
	 * Ex: 0.25.1
	 */

	/**
	 * @private
	 * @property {Autolinker.htmlParser.HtmlParser} htmlParser
	 *
	 * The HtmlParser instance used to skip over HTML tags, while finding text
	 * nodes to process. This is lazily instantiated in the {@link #getHtmlParser}
	 * method.
	 */

	/**
	 * @private
	 * @property {Autolinker.matcher.Matcher[]} matchers
	 *
	 * The {@link Autolinker.matcher.Matcher} instances for this Autolinker
	 * instance.
	 *
	 * This is lazily created in {@link #getMatchers}.
	 */

	/**
	 * @private
	 * @property {Autolinker.AnchorTagBuilder} tagBuilder
	 *
	 * The AnchorTagBuilder instance used to build match replacement anchor tags.
	 * Note: this is lazily instantiated in the {@link #getTagBuilder} method.
	 */


	/**
	 * Normalizes the {@link #urls} config into an Object with 3 properties:
	 * `schemeMatches`, `wwwMatches`, and `tldMatches`, all Booleans.
	 *
	 * See {@link #urls} config for details.
	 *
	 * @private
	 * @param {Boolean/Object} urls
	 * @return {Object}
	 */
	normalizeUrlsCfg : function( urls ) {
		if( urls == null ) urls = true;  // default to `true`

		if( typeof urls === 'boolean' ) {
			return { schemeMatches: urls, wwwMatches: urls, tldMatches: urls };

		} else {  // object form
			return {
				schemeMatches : typeof urls.schemeMatches === 'boolean' ? urls.schemeMatches : true,
				wwwMatches    : typeof urls.wwwMatches === 'boolean'    ? urls.wwwMatches    : true,
				tldMatches    : typeof urls.tldMatches === 'boolean'    ? urls.tldMatches    : true
			};
		}
	},


	/**
	 * Normalizes the {@link #truncate} config into an Object with 2 properties:
	 * `length` (Number), and `location` (String).
	 *
	 * See {@link #truncate} config for details.
	 *
	 * @private
	 * @param {Number/Object} truncate
	 * @return {Object}
	 */
	normalizeTruncateCfg : function( truncate ) {
		if( typeof truncate === 'number' ) {
			return { length: truncate, location: 'end' };

		} else {  // object, or undefined/null
			return Autolinker.Util.defaults( truncate || {}, {
				length   : Number.POSITIVE_INFINITY,
				location : 'end'
			} );
		}
	},


	/**
	 * Parses the input `textOrHtml` looking for URLs, email addresses, phone
	 * numbers, username handles, and hashtags (depending on the configuration
	 * of the Autolinker instance), and returns an array of {@link Autolinker.match.Match}
	 * objects describing those matches.
	 *
	 * This method is used by the {@link #link} method, but can also be used to
	 * simply do parsing of the input in order to discover what kinds of links
	 * there are and how many.
	 *
	 * @param {String} textOrHtml The HTML or text to find matches within
	 *   (depending on if the {@link #urls}, {@link #email}, {@link #phone},
	 *   {@link #twitter}, and {@link #hashtag} options are enabled).
	 * @return {Autolinker.match.Match[]} The array of Matches found in the
	 *   given input `textOrHtml`.
	 */
	parse : function( textOrHtml ) {
		var htmlParser = this.getHtmlParser(),
		    htmlNodes = htmlParser.parse( textOrHtml ),
		    anchorTagStackCount = 0,  // used to only process text around anchor tags, and any inner text/html they may have;
		    matches = [];

		// Find all matches within the `textOrHtml` (but not matches that are
		// already nested within <a> tags)
		for( var i = 0, len = htmlNodes.length; i < len; i++ ) {
			var node = htmlNodes[ i ],
			    nodeType = node.getType();

			if( nodeType === 'element' && node.getTagName() === 'a' ) {  // Process HTML anchor element nodes in the input `textOrHtml` to find out when we're within an <a> tag
				if( !node.isClosing() ) {  // it's the start <a> tag
					anchorTagStackCount++;
				} else {  // it's the end </a> tag
					anchorTagStackCount = Math.max( anchorTagStackCount - 1, 0 );  // attempt to handle extraneous </a> tags by making sure the stack count never goes below 0
				}

			} else if( nodeType === 'text' && anchorTagStackCount === 0 ) {  // Process text nodes that are not within an <a> tag
				var textNodeMatches = this.parseText( node.getText(), node.getOffset() );

				matches.push.apply( matches, textNodeMatches );
			}
		}


		// After we have found all matches, remove subsequent matches that
		// overlap with a previous match. This can happen for instance with URLs,
		// where the url 'google.com/#link' would match '#link' as a hashtag.
		matches = this.compactMatches( matches );

		// And finally, remove matches for match types that have been turned
		// off. We needed to have all match types turned on initially so that
		// things like hashtags could be filtered out if they were really just
		// part of a URL match (for instance, as a named anchor).
		matches = this.removeUnwantedMatches( matches );

		return matches;
	},


	/**
	 * After we have found all matches, we need to remove subsequent matches
	 * that overlap with a previous match. This can happen for instance with
	 * URLs, where the url 'google.com/#link' would match '#link' as a hashtag.
	 *
	 * @private
	 * @param {Autolinker.match.Match[]} matches
	 * @return {Autolinker.match.Match[]}
	 */
	compactMatches : function( matches ) {
		// First, the matches need to be sorted in order of offset
		matches.sort( function( a, b ) { return a.getOffset() - b.getOffset(); } );

		for( var i = 0; i < matches.length - 1; i++ ) {
			var match = matches[ i ],
			    endIdx = match.getOffset() + match.getMatchedText().length;

			// Remove subsequent matches that overlap with the current match
			while( i + 1 < matches.length && matches[ i + 1 ].getOffset() <= endIdx ) {
				matches.splice( i + 1, 1 );
			}
		}

		return matches;
	},


	/**
	 * Removes matches for matchers that were turned off in the options. For
	 * example, if {@link #hashtag hashtags} were not to be matched, we'll
	 * remove them from the `matches` array here.
	 *
	 * @private
	 * @param {Autolinker.match.Match[]} matches The array of matches to remove
	 *   the unwanted matches from. Note: this array is mutated for the
	 *   removals.
	 * @return {Autolinker.match.Match[]} The mutated input `matches` array.
	 */
	removeUnwantedMatches : function( matches ) {
		var remove = Autolinker.Util.remove;

		if( !this.hashtag ) remove( matches, function( match ) { return match.getType() === 'hashtag'; } );
		if( !this.email )   remove( matches, function( match ) { return match.getType() === 'email'; } );
		if( !this.phone )   remove( matches, function( match ) { return match.getType() === 'phone'; } );
		if( !this.twitter ) remove( matches, function( match ) { return match.getType() === 'twitter'; } );
		if( !this.urls.schemeMatches ) {
			remove( matches, function( m ) { return m.getType() === 'url' && m.getUrlMatchType() === 'scheme'; } );
		}
		if( !this.urls.wwwMatches ) {
			remove( matches, function( m ) { return m.getType() === 'url' && m.getUrlMatchType() === 'www'; } );
		}
		if( !this.urls.tldMatches ) {
			remove( matches, function( m ) { return m.getType() === 'url' && m.getUrlMatchType() === 'tld'; } );
		}

		return matches;
	},


	/**
	 * Parses the input `text` looking for URLs, email addresses, phone
	 * numbers, username handles, and hashtags (depending on the configuration
	 * of the Autolinker instance), and returns an array of {@link Autolinker.match.Match}
	 * objects describing those matches.
	 *
	 * This method processes a **non-HTML string**, and is used to parse and
	 * match within the text nodes of an HTML string. This method is used
	 * internally by {@link #parse}.
	 *
	 * @private
	 * @param {String} text The text to find matches within (depending on if the
	 *   {@link #urls}, {@link #email}, {@link #phone}, {@link #twitter}, and
	 *   {@link #hashtag} options are enabled). This must be a non-HTML string.
	 * @param {Number} [offset=0] The offset of the text node within the
	 *   original string. This is used when parsing with the {@link #parse}
	 *   method to generate correct offsets within the {@link Autolinker.match.Match}
	 *   instances, but may be omitted if calling this method publicly.
	 * @return {Autolinker.match.Match[]} The array of Matches found in the
	 *   given input `text`.
	 */
	parseText : function( text, offset ) {
		offset = offset || 0;
		var matchers = this.getMatchers(),
		    matches = [];

		for( var i = 0, numMatchers = matchers.length; i < numMatchers; i++ ) {
			var textMatches = matchers[ i ].parseMatches( text );

			// Correct the offset of each of the matches. They are originally
			// the offset of the match within the provided text node, but we
			// need to correct them to be relative to the original HTML input
			// string (i.e. the one provided to #parse).
			for( var j = 0, numTextMatches = textMatches.length; j < numTextMatches; j++ ) {
				textMatches[ j ].setOffset( offset + textMatches[ j ].getOffset() );
			}

			matches.push.apply( matches, textMatches );
		}
		return matches;
	},


	/**
	 * Automatically links URLs, Email addresses, Phone numbers, Twitter
	 * handles, and Hashtags found in the given chunk of HTML. Does not link
	 * URLs found within HTML tags.
	 *
	 * For instance, if given the text: `You should go to http://www.yahoo.com`,
	 * then the result will be `You should go to
	 * &lt;a href="http://www.yahoo.com"&gt;http://www.yahoo.com&lt;/a&gt;`
	 *
	 * This method finds the text around any HTML elements in the input
	 * `textOrHtml`, which will be the text that is processed. Any original HTML
	 * elements will be left as-is, as well as the text that is already wrapped
	 * in anchor (&lt;a&gt;) tags.
	 *
	 * @param {String} textOrHtml The HTML or text to autolink matches within
	 *   (depending on if the {@link #urls}, {@link #email}, {@link #phone},
	 *   {@link #twitter}, and {@link #hashtag} options are enabled).
	 * @return {String} The HTML, with matches automatically linked.
	 */
	link : function( textOrHtml ) {
		if( !textOrHtml ) { return ""; }  // handle `null` and `undefined`

		var matches = this.parse( textOrHtml ),
			newHtml = [],
			lastIndex = 0;

		for( var i = 0, len = matches.length; i < len; i++ ) {
			var match = matches[ i ];

			newHtml.push( textOrHtml.substring( lastIndex, match.getOffset() ) );
			newHtml.push( this.createMatchReturnVal( match ) );

			lastIndex = match.getOffset() + match.getMatchedText().length;
		}
		newHtml.push( textOrHtml.substring( lastIndex ) );  // handle the text after the last match

		return newHtml.join( '' );
	},


	/**
	 * Creates the return string value for a given match in the input string.
	 *
	 * This method handles the {@link #replaceFn}, if one was provided.
	 *
	 * @private
	 * @param {Autolinker.match.Match} match The Match object that represents
	 *   the match.
	 * @return {String} The string that the `match` should be replaced with.
	 *   This is usually the anchor tag string, but may be the `matchStr` itself
	 *   if the match is not to be replaced.
	 */
	createMatchReturnVal : function( match ) {
		// Handle a custom `replaceFn` being provided
		var replaceFnResult;
		if( this.replaceFn ) {
			replaceFnResult = this.replaceFn.call( this, this, match );  // Autolinker instance is the context, and the first arg
		}

		if( typeof replaceFnResult === 'string' ) {
			return replaceFnResult;  // `replaceFn` returned a string, use that

		} else if( replaceFnResult === false ) {
			return match.getMatchedText();  // no replacement for the match

		} else if( replaceFnResult instanceof Autolinker.HtmlTag ) {
			return replaceFnResult.toAnchorString();

		} else {  // replaceFnResult === true, or no/unknown return value from function
			// Perform Autolinker's default anchor tag generation
			var anchorTag = match.buildTag();  // returns an Autolinker.HtmlTag instance

			return anchorTag.toAnchorString();
		}
	},


	/**
	 * Lazily instantiates and returns the {@link #htmlParser} instance for this
	 * Autolinker instance.
	 *
	 * @protected
	 * @return {Autolinker.htmlParser.HtmlParser}
	 */
	getHtmlParser : function() {
		var htmlParser = this.htmlParser;

		if( !htmlParser ) {
			htmlParser = this.htmlParser = new Autolinker.htmlParser.HtmlParser();
		}

		return htmlParser;
	},


	/**
	 * Lazily instantiates and returns the {@link Autolinker.matcher.Matcher}
	 * instances for this Autolinker instance.
	 *
	 * @protected
	 * @return {Autolinker.matcher.Matcher[]}
	 */
	getMatchers : function() {
		if( !this.matchers ) {
			var matchersNs = Autolinker.matcher,
			    tagBuilder = this.getTagBuilder();

			var matchers = [
				new matchersNs.Hashtag( { tagBuilder: tagBuilder, serviceName: this.hashtag } ),
				new matchersNs.Email( { tagBuilder: tagBuilder } ),
				new matchersNs.Phone( { tagBuilder: tagBuilder } ),
				new matchersNs.Twitter( { tagBuilder: tagBuilder } ),
				new matchersNs.Url( { tagBuilder: tagBuilder, stripPrefix: this.stripPrefix } )
			];

			return ( this.matchers = matchers );

		} else {
			return this.matchers;
		}
	},


	/**
	 * Returns the {@link #tagBuilder} instance for this Autolinker instance, lazily instantiating it
	 * if it does not yet exist.
	 *
	 * This method may be used in a {@link #replaceFn} to generate the {@link Autolinker.HtmlTag HtmlTag} instance that
	 * Autolinker would normally generate, and then allow for modifications before returning it. For example:
	 *
	 *     var html = Autolinker.link( "Test google.com", {
	 *         replaceFn : function( autolinker, match ) {
	 *             var tag = autolinker.getTagBuilder().build( match );  // returns an {@link Autolinker.HtmlTag} instance
	 *             tag.setAttr( 'rel', 'nofollow' );
	 *
	 *             return tag;
	 *         }
	 *     } );
	 *
	 *     // generated html:
	 *     //   Test <a href="http://google.com" target="_blank" rel="nofollow">google.com</a>
	 *
	 * @return {Autolinker.AnchorTagBuilder}
	 */
	getTagBuilder : function() {
		var tagBuilder = this.tagBuilder;

		if( !tagBuilder ) {
			tagBuilder = this.tagBuilder = new Autolinker.AnchorTagBuilder( {
				newWindow   : this.newWindow,
				truncate    : this.truncate,
				className   : this.className
			} );
		}

		return tagBuilder;
	}

};


// Autolinker Namespaces

Autolinker.match = {};
Autolinker.matcher = {};
Autolinker.htmlParser = {};
Autolinker.truncate = {};

/*global Autolinker */
/*jshint eqnull:true, boss:true */
/**
 * @class Autolinker.Util
 * @singleton
 *
 * A few utility methods for Autolinker.
 */
Autolinker.Util = {

	/**
	 * @property {Function} abstractMethod
	 *
	 * A function object which represents an abstract method.
	 */
	abstractMethod : function() { throw "abstract"; },


	/**
	 * @private
	 * @property {RegExp} trimRegex
	 *
	 * The regular expression used to trim the leading and trailing whitespace
	 * from a string.
	 */
	trimRegex : /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,


	/**
	 * Assigns (shallow copies) the properties of `src` onto `dest`.
	 *
	 * @param {Object} dest The destination object.
	 * @param {Object} src The source object.
	 * @return {Object} The destination object (`dest`)
	 */
	assign : function( dest, src ) {
		for( var prop in src ) {
			if( src.hasOwnProperty( prop ) ) {
				dest[ prop ] = src[ prop ];
			}
		}

		return dest;
	},


	/**
	 * Assigns (shallow copies) the properties of `src` onto `dest`, if the
	 * corresponding property on `dest` === `undefined`.
	 *
	 * @param {Object} dest The destination object.
	 * @param {Object} src The source object.
	 * @return {Object} The destination object (`dest`)
	 */
	defaults : function( dest, src ) {
		for( var prop in src ) {
			if( src.hasOwnProperty( prop ) && dest[ prop ] === undefined ) {
				dest[ prop ] = src[ prop ];
			}
		}

		return dest;
	},


	/**
	 * Extends `superclass` to create a new subclass, adding the `protoProps` to the new subclass's prototype.
	 *
	 * @param {Function} superclass The constructor function for the superclass.
	 * @param {Object} protoProps The methods/properties to add to the subclass's prototype. This may contain the
	 *   special property `constructor`, which will be used as the new subclass's constructor function.
	 * @return {Function} The new subclass function.
	 */
	extend : function( superclass, protoProps ) {
		var superclassProto = superclass.prototype;

		var F = function() {};
		F.prototype = superclassProto;

		var subclass;
		if( protoProps.hasOwnProperty( 'constructor' ) ) {
			subclass = protoProps.constructor;
		} else {
			subclass = function() { superclassProto.constructor.apply( this, arguments ); };
		}

		var subclassProto = subclass.prototype = new F();  // set up prototype chain
		subclassProto.constructor = subclass;  // fix constructor property
		subclassProto.superclass = superclassProto;

		delete protoProps.constructor;  // don't re-assign constructor property to the prototype, since a new function may have been created (`subclass`), which is now already there
		Autolinker.Util.assign( subclassProto, protoProps );

		return subclass;
	},


	/**
	 * Truncates the `str` at `len - ellipsisChars.length`, and adds the `ellipsisChars` to the
	 * end of the string (by default, two periods: '..'). If the `str` length does not exceed
	 * `len`, the string will be returned unchanged.
	 *
	 * @param {String} str The string to truncate and add an ellipsis to.
	 * @param {Number} truncateLen The length to truncate the string at.
	 * @param {String} [ellipsisChars=..] The ellipsis character(s) to add to the end of `str`
	 *   when truncated. Defaults to '..'
	 */
	ellipsis : function( str, truncateLen, ellipsisChars ) {
		if( str.length > truncateLen ) {
			ellipsisChars = ( ellipsisChars == null ) ? '..' : ellipsisChars;
			str = str.substring( 0, truncateLen - ellipsisChars.length ) + ellipsisChars;
		}
		return str;
	},


	/**
	 * Supports `Array.prototype.indexOf()` functionality for old IE (IE8 and below).
	 *
	 * @param {Array} arr The array to find an element of.
	 * @param {*} element The element to find in the array, and return the index of.
	 * @return {Number} The index of the `element`, or -1 if it was not found.
	 */
	indexOf : function( arr, element ) {
		if( Array.prototype.indexOf ) {
			return arr.indexOf( element );

		} else {
			for( var i = 0, len = arr.length; i < len; i++ ) {
				if( arr[ i ] === element ) return i;
			}
			return -1;
		}
	},


	/**
	 * Removes array elements based on a filtering function. Mutates the input
	 * array.
	 *
	 * Using this instead of the ES5 Array.prototype.filter() function, to allow
	 * Autolinker compatibility with IE8, and also to prevent creating many new
	 * arrays in memory for filtering.
	 *
	 * @param {Array} arr The array to remove elements from. This array is
	 *   mutated.
	 * @param {Function} fn A function which should return `true` to
	 *   remove an element.
	 * @return {Array} The mutated input `arr`.
	 */
	remove : function( arr, fn ) {
		for( var i = arr.length - 1; i >= 0; i-- ) {
			if( fn( arr[ i ] ) === true ) {
				arr.splice( i, 1 );
			}
		}
	},


	/**
	 * Performs the functionality of what modern browsers do when `String.prototype.split()` is called
	 * with a regular expression that contains capturing parenthesis.
	 *
	 * For example:
	 *
	 *     // Modern browsers:
	 *     "a,b,c".split( /(,)/ );  // --> [ 'a', ',', 'b', ',', 'c' ]
	 *
	 *     // Old IE (including IE8):
	 *     "a,b,c".split( /(,)/ );  // --> [ 'a', 'b', 'c' ]
	 *
	 * This method emulates the functionality of modern browsers for the old IE case.
	 *
	 * @param {String} str The string to split.
	 * @param {RegExp} splitRegex The regular expression to split the input `str` on. The splitting
	 *   character(s) will be spliced into the array, as in the "modern browsers" example in the
	 *   description of this method.
	 *   Note #1: the supplied regular expression **must** have the 'g' flag specified.
	 *   Note #2: for simplicity's sake, the regular expression does not need
	 *   to contain capturing parenthesis - it will be assumed that any match has them.
	 * @return {String[]} The split array of strings, with the splitting character(s) included.
	 */
	splitAndCapture : function( str, splitRegex ) {
		if( !splitRegex.global ) throw new Error( "`splitRegex` must have the 'g' flag set" );

		var result = [],
		    lastIdx = 0,
		    match;

		while( match = splitRegex.exec( str ) ) {
			result.push( str.substring( lastIdx, match.index ) );
			result.push( match[ 0 ] );  // push the splitting char(s)

			lastIdx = match.index + match[ 0 ].length;
		}
		result.push( str.substring( lastIdx ) );

		return result;
	},


	/**
	 * Trims the leading and trailing whitespace from a string.
	 *
	 * @param {String} str The string to trim.
	 * @return {String}
	 */
	trim : function( str ) {
		return str.replace( this.trimRegex, '' );
	}

};
/*global Autolinker */
/*jshint boss:true */
/**
 * @class Autolinker.HtmlTag
 * @extends Object
 *
 * Represents an HTML tag, which can be used to easily build/modify HTML tags programmatically.
 *
 * Autolinker uses this abstraction to create HTML tags, and then write them out as strings. You may also use
 * this class in your code, especially within a {@link Autolinker#replaceFn replaceFn}.
 *
 * ## Examples
 *
 * Example instantiation:
 *
 *     var tag = new Autolinker.HtmlTag( {
 *         tagName : 'a',
 *         attrs   : { 'href': 'http://google.com', 'class': 'external-link' },
 *         innerHtml : 'Google'
 *     } );
 *
 *     tag.toAnchorString();  // <a href="http://google.com" class="external-link">Google</a>
 *
 *     // Individual accessor methods
 *     tag.getTagName();                 // 'a'
 *     tag.getAttr( 'href' );            // 'http://google.com'
 *     tag.hasClass( 'external-link' );  // true
 *
 *
 * Using mutator methods (which may be used in combination with instantiation config properties):
 *
 *     var tag = new Autolinker.HtmlTag();
 *     tag.setTagName( 'a' );
 *     tag.setAttr( 'href', 'http://google.com' );
 *     tag.addClass( 'external-link' );
 *     tag.setInnerHtml( 'Google' );
 *
 *     tag.getTagName();                 // 'a'
 *     tag.getAttr( 'href' );            // 'http://google.com'
 *     tag.hasClass( 'external-link' );  // true
 *
 *     tag.toAnchorString();  // <a href="http://google.com" class="external-link">Google</a>
 *
 *
 * ## Example use within a {@link Autolinker#replaceFn replaceFn}
 *
 *     var html = Autolinker.link( "Test google.com", {
 *         replaceFn : function( autolinker, match ) {
 *             var tag = match.buildTag();  // returns an {@link Autolinker.HtmlTag} instance, configured with the Match's href and anchor text
 *             tag.setAttr( 'rel', 'nofollow' );
 *
 *             return tag;
 *         }
 *     } );
 *
 *     // generated html:
 *     //   Test <a href="http://google.com" target="_blank" rel="nofollow">google.com</a>
 *
 *
 * ## Example use with a new tag for the replacement
 *
 *     var html = Autolinker.link( "Test google.com", {
 *         replaceFn : function( autolinker, match ) {
 *             var tag = new Autolinker.HtmlTag( {
 *                 tagName : 'button',
 *                 attrs   : { 'title': 'Load URL: ' + match.getAnchorHref() },
 *                 innerHtml : 'Load URL: ' + match.getAnchorText()
 *             } );
 *
 *             return tag;
 *         }
 *     } );
 *
 *     // generated html:
 *     //   Test <button title="Load URL: http://google.com">Load URL: google.com</button>
 */
Autolinker.HtmlTag = Autolinker.Util.extend( Object, {

	/**
	 * @cfg {String} tagName
	 *
	 * The tag name. Ex: 'a', 'button', etc.
	 *
	 * Not required at instantiation time, but should be set using {@link #setTagName} before {@link #toAnchorString}
	 * is executed.
	 */

	/**
	 * @cfg {Object.<String, String>} attrs
	 *
	 * An key/value Object (map) of attributes to create the tag with. The keys are the attribute names, and the
	 * values are the attribute values.
	 */

	/**
	 * @cfg {String} innerHtml
	 *
	 * The inner HTML for the tag.
	 *
	 * Note the camel case name on `innerHtml`. Acronyms are camelCased in this utility (such as not to run into the acronym
	 * naming inconsistency that the DOM developers created with `XMLHttpRequest`). You may alternatively use {@link #innerHTML}
	 * if you prefer, but this one is recommended.
	 */

	/**
	 * @cfg {String} innerHTML
	 *
	 * Alias of {@link #innerHtml}, accepted for consistency with the browser DOM api, but prefer the camelCased version
	 * for acronym names.
	 */


	/**
	 * @protected
	 * @property {RegExp} whitespaceRegex
	 *
	 * Regular expression used to match whitespace in a string of CSS classes.
	 */
	whitespaceRegex : /\s+/,


	/**
	 * @constructor
	 * @param {Object} [cfg] The configuration properties for this class, in an Object (map)
	 */
	constructor : function( cfg ) {
		Autolinker.Util.assign( this, cfg );

		this.innerHtml = this.innerHtml || this.innerHTML;  // accept either the camelCased form or the fully capitalized acronym
	},


	/**
	 * Sets the tag name that will be used to generate the tag with.
	 *
	 * @param {String} tagName
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	setTagName : function( tagName ) {
		this.tagName = tagName;
		return this;
	},


	/**
	 * Retrieves the tag name.
	 *
	 * @return {String}
	 */
	getTagName : function() {
		return this.tagName || "";
	},


	/**
	 * Sets an attribute on the HtmlTag.
	 *
	 * @param {String} attrName The attribute name to set.
	 * @param {String} attrValue The attribute value to set.
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	setAttr : function( attrName, attrValue ) {
		var tagAttrs = this.getAttrs();
		tagAttrs[ attrName ] = attrValue;

		return this;
	},


	/**
	 * Retrieves an attribute from the HtmlTag. If the attribute does not exist, returns `undefined`.
	 *
	 * @param {String} attrName The attribute name to retrieve.
	 * @return {String} The attribute's value, or `undefined` if it does not exist on the HtmlTag.
	 */
	getAttr : function( attrName ) {
		return this.getAttrs()[ attrName ];
	},


	/**
	 * Sets one or more attributes on the HtmlTag.
	 *
	 * @param {Object.<String, String>} attrs A key/value Object (map) of the attributes to set.
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	setAttrs : function( attrs ) {
		var tagAttrs = this.getAttrs();
		Autolinker.Util.assign( tagAttrs, attrs );

		return this;
	},


	/**
	 * Retrieves the attributes Object (map) for the HtmlTag.
	 *
	 * @return {Object.<String, String>} A key/value object of the attributes for the HtmlTag.
	 */
	getAttrs : function() {
		return this.attrs || ( this.attrs = {} );
	},


	/**
	 * Sets the provided `cssClass`, overwriting any current CSS classes on the HtmlTag.
	 *
	 * @param {String} cssClass One or more space-separated CSS classes to set (overwrite).
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	setClass : function( cssClass ) {
		return this.setAttr( 'class', cssClass );
	},


	/**
	 * Convenience method to add one or more CSS classes to the HtmlTag. Will not add duplicate CSS classes.
	 *
	 * @param {String} cssClass One or more space-separated CSS classes to add.
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	addClass : function( cssClass ) {
		var classAttr = this.getClass(),
		    whitespaceRegex = this.whitespaceRegex,
		    indexOf = Autolinker.Util.indexOf,  // to support IE8 and below
		    classes = ( !classAttr ) ? [] : classAttr.split( whitespaceRegex ),
		    newClasses = cssClass.split( whitespaceRegex ),
		    newClass;

		while( newClass = newClasses.shift() ) {
			if( indexOf( classes, newClass ) === -1 ) {
				classes.push( newClass );
			}
		}

		this.getAttrs()[ 'class' ] = classes.join( " " );
		return this;
	},


	/**
	 * Convenience method to remove one or more CSS classes from the HtmlTag.
	 *
	 * @param {String} cssClass One or more space-separated CSS classes to remove.
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	removeClass : function( cssClass ) {
		var classAttr = this.getClass(),
		    whitespaceRegex = this.whitespaceRegex,
		    indexOf = Autolinker.Util.indexOf,  // to support IE8 and below
		    classes = ( !classAttr ) ? [] : classAttr.split( whitespaceRegex ),
		    removeClasses = cssClass.split( whitespaceRegex ),
		    removeClass;

		while( classes.length && ( removeClass = removeClasses.shift() ) ) {
			var idx = indexOf( classes, removeClass );
			if( idx !== -1 ) {
				classes.splice( idx, 1 );
			}
		}

		this.getAttrs()[ 'class' ] = classes.join( " " );
		return this;
	},


	/**
	 * Convenience method to retrieve the CSS class(es) for the HtmlTag, which will each be separated by spaces when
	 * there are multiple.
	 *
	 * @return {String}
	 */
	getClass : function() {
		return this.getAttrs()[ 'class' ] || "";
	},


	/**
	 * Convenience method to check if the tag has a CSS class or not.
	 *
	 * @param {String} cssClass The CSS class to check for.
	 * @return {Boolean} `true` if the HtmlTag has the CSS class, `false` otherwise.
	 */
	hasClass : function( cssClass ) {
		return ( ' ' + this.getClass() + ' ' ).indexOf( ' ' + cssClass + ' ' ) !== -1;
	},


	/**
	 * Sets the inner HTML for the tag.
	 *
	 * @param {String} html The inner HTML to set.
	 * @return {Autolinker.HtmlTag} This HtmlTag instance, so that method calls may be chained.
	 */
	setInnerHtml : function( html ) {
		this.innerHtml = html;

		return this;
	},


	/**
	 * Retrieves the inner HTML for the tag.
	 *
	 * @return {String}
	 */
	getInnerHtml : function() {
		return this.innerHtml || "";
	},


	/**
	 * Override of superclass method used to generate the HTML string for the tag.
	 *
	 * @return {String}
	 */
	toAnchorString : function() {
		var tagName = this.getTagName(),
		    attrsStr = this.buildAttrsStr();

		attrsStr = ( attrsStr ) ? ' ' + attrsStr : '';  // prepend a space if there are actually attributes

		return [ '<', tagName, attrsStr, '>', this.getInnerHtml(), '</', tagName, '>' ].join( "" );
	},


	/**
	 * Support method for {@link #toAnchorString}, returns the string space-separated key="value" pairs, used to populate
	 * the stringified HtmlTag.
	 *
	 * @protected
	 * @return {String} Example return: `attr1="value1" attr2="value2"`
	 */
	buildAttrsStr : function() {
		if( !this.attrs ) return "";  // no `attrs` Object (map) has been set, return empty string

		var attrs = this.getAttrs(),
		    attrsArr = [];

		for( var prop in attrs ) {
			if( attrs.hasOwnProperty( prop ) ) {
				attrsArr.push( prop + '="' + attrs[ prop ] + '"' );
			}
		}
		return attrsArr.join( " " );
	}

} );

/*global Autolinker */
/**
 * @class Autolinker.RegexLib
 * @singleton
 *
 * Builds and stores a library of the common regular expressions used by the
 * Autolinker utility.
 *
 * Other regular expressions may exist ad-hoc, but these are generally the
 * regular expressions that are shared between source files.
 */
Autolinker.RegexLib = (function() {

	/**
	 * The string form of a regular expression that would match all of the
	 * alphabetic ("letter") chars in the unicode character set when placed in a
	 * RegExp character class (`[]`). This includes all international alphabetic
	 * characters.
	 *
	 * These would be the characters matched by unicode regex engines `\p{L}`
	 * escape ("all letters").
	 *
	 * Taken from the XRegExp library: http://xregexp.com/
	 * Specifically: http://xregexp.com/v/3.0.0/unicode-categories.js
	 *
	 * @private
	 * @type {String}
	 */
	var alphaCharsStr = 'A-Za-z\\xAA\\xB5\\xBA\\xC0-\\xD6\\xD8-\\xF6\\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC';

	/**
	 * The string form of a regular expression that would match all of the
	 * decimal number chars in the unicode character set when placed in a RegExp
	 * character class (`[]`).
	 *
	 * These would be the characters matched by unicode regex engines `\p{Nd}`
	 * escape ("all decimal numbers")
	 *
	 * Taken from the XRegExp library: http://xregexp.com/
	 * Specifically: http://xregexp.com/v/3.0.0/unicode-categories.js
	 *
	 * @private
	 * @type {String}
	 */
	var decimalNumbersStr = '0-9\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u1090-\u1099\u17E0-\u17E9\u1810-\u1819\u1946-\u194F\u19D0-\u19D9\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\uA620-\uA629\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19';


	// See documentation below
	var alphaNumericCharsStr = alphaCharsStr + decimalNumbersStr;


	// See documentation below
	var domainNameRegex = new RegExp( '[' + alphaNumericCharsStr + '.\\-]*[' + alphaNumericCharsStr + '\\-]' );


	// See documentation below
	var tldRegex = /(?:travelersinsurance|sandvikcoromant|kerryproperties|cancerresearch|weatherchannel|kerrylogistics|spreadbetting|international|wolterskluwer|lifeinsurance|construction|pamperedchef|scholarships|versicherung|bridgestone|creditunion|kerryhotels|investments|productions|blackfriday|enterprises|lamborghini|photography|motorcycles|williamhill|playstation|contractors|barclaycard|accountants|redumbrella|engineering|management|telefonica|protection|consulting|tatamotors|creditcard|vlaanderen|schaeffler|associates|properties|foundation|republican|bnpparibas|boehringer|eurovision|extraspace|industries|immobilien|university|technology|volkswagen|healthcare|restaurant|cuisinella|vistaprint|apartments|accountant|travelers|homedepot|institute|vacations|furniture|fresenius|insurance|christmas|bloomberg|solutions|barcelona|firestone|financial|kuokgroup|fairwinds|community|passagens|goldpoint|equipment|lifestyle|yodobashi|aquarelle|marketing|analytics|education|amsterdam|statefarm|melbourne|allfinanz|directory|microsoft|stockholm|montblanc|accenture|lancaster|landrover|everbank|istanbul|graphics|grainger|ipiranga|softbank|attorney|pharmacy|saarland|catering|airforce|yokohama|mortgage|frontier|mutuelle|stcgroup|memorial|pictures|football|symantec|cipriani|ventures|telecity|cityeats|verisign|flsmidth|boutique|cleaning|firmdale|clinique|clothing|redstone|infiniti|deloitte|feedback|services|broadway|plumbing|commbank|training|barclays|exchange|computer|brussels|software|delivery|barefoot|builders|business|bargains|engineer|holdings|download|security|helsinki|lighting|movistar|discount|hdfcbank|supplies|marriott|property|diamonds|capetown|partners|democrat|jpmorgan|bradesco|budapest|rexroth|zuerich|shriram|academy|science|support|youtube|singles|surgery|alibaba|statoil|dentist|schwarz|android|cruises|cricket|digital|markets|starhub|systems|courses|coupons|netbank|country|domains|corsica|network|neustar|realtor|lincoln|limited|schmidt|yamaxun|cooking|contact|auction|spiegel|liaison|leclerc|latrobe|lasalle|abogado|compare|lanxess|exposed|express|company|cologne|college|avianca|lacaixa|fashion|recipes|ferrero|komatsu|storage|wanggou|clubmed|sandvik|fishing|fitness|bauhaus|kitchen|flights|florist|flowers|watches|weather|temasek|samsung|bentley|forsale|channel|theater|frogans|theatre|okinawa|website|tickets|jewelry|gallery|tiffany|iselect|shiksha|brother|organic|wedding|genting|toshiba|origins|philips|hyundai|hotmail|hoteles|hosting|rentals|windows|cartier|bugatti|holiday|careers|whoswho|hitachi|panerai|caravan|reviews|guitars|capital|trading|hamburg|hangout|finance|stream|family|abbott|health|review|travel|report|hermes|hiphop|gratis|career|toyota|hockey|dating|repair|google|social|soccer|reisen|global|otsuka|giving|unicom|casino|photos|center|broker|rocher|orange|bostik|garden|insure|ryukyu|bharti|safety|physio|sakura|oracle|online|jaguar|gallup|piaget|tienda|futbol|pictet|joburg|webcam|berlin|office|juegos|kaufen|chanel|chrome|xihuan|church|tennis|circle|kinder|flickr|bayern|claims|clinic|viajes|nowruz|xperia|norton|yachts|studio|coffee|camera|sanofi|nissan|author|expert|events|comsec|lawyer|tattoo|viking|estate|villas|condos|realty|yandex|energy|emerck|virgin|vision|durban|living|school|coupon|london|taobao|natura|taipei|nagoya|luxury|walter|aramco|sydney|madrid|credit|maison|makeup|schule|market|anquan|direct|design|swatch|suzuki|alsace|vuelos|dental|alipay|voyage|shouji|voting|airtel|mutual|degree|supply|agency|museum|mobily|dealer|monash|select|mormon|active|moscow|racing|datsun|quebec|nissay|rodeo|email|gifts|works|photo|chloe|edeka|cheap|earth|vista|tushu|koeln|glass|shoes|globo|tunes|gmail|nokia|space|kyoto|black|ricoh|seven|lamer|sener|epson|cisco|praxi|trust|citic|crown|shell|lease|green|legal|lexus|ninja|tatar|gripe|nikon|group|video|wales|autos|gucci|party|nexus|guide|linde|adult|parts|amica|lixil|boats|azure|loans|locus|cymru|lotte|lotto|stada|click|poker|quest|dabur|lupin|nadex|paris|faith|dance|canon|place|gives|trade|skype|rocks|mango|cloud|boots|smile|final|swiss|homes|honda|media|horse|cards|deals|watch|bosch|house|pizza|miami|osaka|tours|total|xerox|coach|sucks|style|delta|toray|iinet|tools|money|codes|beats|tokyo|salon|archi|movie|baidu|study|actor|yahoo|store|apple|world|forex|today|bible|tmall|tirol|irish|tires|forum|reise|vegas|vodka|sharp|omega|weber|jetzt|audio|promo|build|bingo|chase|gallo|drive|dubai|rehab|press|solar|sale|beer|bbva|bank|band|auto|sapo|sarl|saxo|audi|asia|arte|arpa|army|yoga|ally|zara|scor|scot|sexy|seat|zero|seek|aero|adac|zone|aarp|maif|meet|meme|menu|surf|mini|mobi|mtpc|porn|desi|star|ltda|name|talk|navy|love|loan|live|link|news|limo|like|spot|life|nico|lidl|lgbt|land|taxi|team|tech|kred|kpmg|sony|song|kiwi|kddi|jprs|jobs|sohu|java|itau|tips|info|immo|icbc|hsbc|town|host|page|toys|here|help|pars|haus|guru|guge|tube|goog|golf|gold|sncf|gmbh|gift|ggee|gent|gbiz|game|vana|pics|fund|ford|ping|pink|fish|film|fast|farm|play|fans|fail|plus|skin|pohl|fage|moda|post|erni|dvag|prod|doha|prof|docs|viva|diet|luxe|site|dell|sina|dclk|show|qpon|date|vote|cyou|voto|read|coop|cool|wang|club|city|chat|cern|cash|reit|rent|casa|cars|care|camp|rest|call|cafe|weir|wien|rich|wiki|buzz|wine|book|bond|room|work|rsvp|shia|ruhr|blue|bing|shaw|bike|safe|xbox|best|pwc|mtn|lds|aig|boo|fyi|nra|nrw|ntt|car|gal|obi|zip|aeg|vin|how|one|ong|onl|dad|ooo|bet|esq|org|htc|bar|uol|ibm|ovh|gdn|ice|icu|uno|gea|ifm|bot|top|wtf|lol|day|pet|eus|wtc|ubs|tvs|aco|ing|ltd|ink|tab|abb|afl|cat|int|pid|pin|bid|cba|gle|com|cbn|ads|man|wed|ceb|gmo|sky|ist|gmx|tui|mba|fan|ski|iwc|app|pro|med|ceo|jcb|jcp|goo|dev|men|aaa|meo|pub|jlc|bom|jll|gop|jmp|mil|got|gov|win|jot|mma|joy|trv|red|cfa|cfd|bio|moe|moi|mom|ren|biz|aws|xin|bbc|dnp|buy|kfh|mov|thd|xyz|fit|kia|rio|rip|kim|dog|vet|nyc|bcg|mtr|bcn|bms|bmw|run|bzh|rwe|tel|stc|axa|kpn|fly|krd|cab|bnl|foo|crs|eat|tci|sap|srl|nec|sas|net|cal|sbs|sfr|sca|scb|csc|edu|new|xxx|hiv|fox|wme|ngo|nhk|vip|sex|frl|lat|yun|law|you|tax|soy|sew|om|ac|hu|se|sc|sg|sh|sb|sa|rw|ru|rs|ro|re|qa|py|si|pw|pt|ps|sj|sk|pr|pn|pm|pl|sl|sm|pk|sn|ph|so|pg|pf|pe|pa|zw|nz|nu|nr|np|no|nl|ni|ng|nf|sr|ne|st|nc|na|mz|my|mx|mw|mv|mu|mt|ms|mr|mq|mp|mo|su|mn|mm|ml|mk|mh|mg|me|sv|md|mc|sx|sy|ma|ly|lv|sz|lu|lt|ls|lr|lk|li|lc|lb|la|tc|kz|td|ky|kw|kr|kp|kn|km|ki|kh|tf|tg|th|kg|ke|jp|jo|jm|je|it|is|ir|tj|tk|tl|tm|iq|tn|to|io|in|im|il|ie|ad|sd|ht|hr|hn|hm|tr|hk|gy|gw|gu|gt|gs|gr|gq|tt|gp|gn|gm|gl|tv|gi|tw|tz|ua|gh|ug|uk|gg|gf|ge|gd|us|uy|uz|va|gb|ga|vc|ve|fr|fo|fm|fk|fj|vg|vi|fi|eu|et|es|er|eg|ee|ec|dz|do|dm|dk|vn|dj|de|cz|cy|cx|cw|vu|cv|cu|cr|co|cn|cm|cl|ck|ci|ch|cg|cf|cd|cc|ca|wf|bz|by|bw|bv|bt|bs|br|bo|bn|bm|bj|bi|ws|bh|bg|bf|be|bd|bb|ba|az|ax|aw|au|at|as|ye|ar|aq|ao|am|al|yt|ai|za|ag|af|ae|zm|id)\b/;


	return {

		/**
		 * The string form of a regular expression that would match all of the
		 * letters and decimal number chars in the unicode character set when placed
		 * in a RegExp character class (`[]`).
		 *
		 * These would be the characters matched by unicode regex engines `[\p{L}\p{Nd}]`
		 * escape ("all letters and decimal numbers")
		 *
		 * @property {String} alphaNumericCharsStr
		 */
		alphaNumericCharsStr : alphaNumericCharsStr,

		/**
		 * A regular expression to match domain names of a URL or email address.
		 * Ex: 'google', 'yahoo', 'some-other-company', etc.
		 *
		 * @property {RegExp} domainNameRegex
		 */
		domainNameRegex : domainNameRegex,

		/**
		 * A regular expression to match top level domains (TLDs) for a URL or
		 * email address. Ex: 'com', 'org', 'net', etc.
		 *
		 * @property {RegExp} tldRegex
		 */
		tldRegex : tldRegex

	};


}() );
/*global Autolinker */
/*jshint sub:true */
/**
 * @protected
 * @class Autolinker.AnchorTagBuilder
 * @extends Object
 *
 * Builds anchor (&lt;a&gt;) tags for the Autolinker utility when a match is
 * found.
 *
 * Normally this class is instantiated, configured, and used internally by an
 * {@link Autolinker} instance, but may actually be retrieved in a {@link Autolinker#replaceFn replaceFn}
 * to create {@link Autolinker.HtmlTag HtmlTag} instances which may be modified
 * before returning from the {@link Autolinker#replaceFn replaceFn}. For
 * example:
 *
 *     var html = Autolinker.link( "Test google.com", {
 *         replaceFn : function( autolinker, match ) {
 *             var tag = autolinker.getTagBuilder().build( match );  // returns an {@link Autolinker.HtmlTag} instance
 *             tag.setAttr( 'rel', 'nofollow' );
 *
 *             return tag;
 *         }
 *     } );
 *
 *     // generated html:
 *     //   Test <a href="http://google.com" target="_blank" rel="nofollow">google.com</a>
 */
Autolinker.AnchorTagBuilder = Autolinker.Util.extend( Object, {

	/**
	 * @cfg {Boolean} newWindow
	 * @inheritdoc Autolinker#newWindow
	 */

	/**
	 * @cfg {Object} truncate
	 * @inheritdoc Autolinker#truncate
	 */

	/**
	 * @cfg {String} className
	 * @inheritdoc Autolinker#className
	 */


	/**
	 * @constructor
	 * @param {Object} [cfg] The configuration options for the AnchorTagBuilder instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.Util.assign( this, cfg );
	},


	/**
	 * Generates the actual anchor (&lt;a&gt;) tag to use in place of the
	 * matched text, via its `match` object.
	 *
	 * @param {Autolinker.match.Match} match The Match instance to generate an
	 *   anchor tag from.
	 * @return {Autolinker.HtmlTag} The HtmlTag instance for the anchor tag.
	 */
	build : function( match ) {
		return new Autolinker.HtmlTag( {
			tagName   : 'a',
			attrs     : this.createAttrs( match.getType(), match.getAnchorHref() ),
			innerHtml : this.processAnchorText( match.getAnchorText() )
		} );
	},


	/**
	 * Creates the Object (map) of the HTML attributes for the anchor (&lt;a&gt;)
	 *   tag being generated.
	 *
	 * @protected
	 * @param {"url"/"email"/"phone"/"twitter"/"hashtag"} matchType The type of
	 *   match that an anchor tag is being generated for.
	 * @param {String} anchorHref The href for the anchor tag.
	 * @return {Object} A key/value Object (map) of the anchor tag's attributes.
	 */
	createAttrs : function( matchType, anchorHref ) {
		var attrs = {
			'href' : anchorHref  // we'll always have the `href` attribute
		};

		var cssClass = this.createCssClass( matchType );
		if( cssClass ) {
			attrs[ 'class' ] = cssClass;
		}
		if( this.newWindow ) {
			attrs[ 'target' ] = "_blank";
			attrs[ 'rel' ] = "noopener noreferrer";
		}

		return attrs;
	},


	/**
	 * Creates the CSS class that will be used for a given anchor tag, based on
	 * the `matchType` and the {@link #className} config.
	 *
	 * @private
	 * @param {"url"/"email"/"phone"/"twitter"/"hashtag"} matchType The type of
	 *   match that an anchor tag is being generated for.
	 * @return {String} The CSS class string for the link. Example return:
	 *   "myLink myLink-url". If no {@link #className} was configured, returns
	 *   an empty string.
	 */
	createCssClass : function( matchType ) {
		var className = this.className;

		if( !className )
			return "";
		else
			return className + " " + className + "-" + matchType;  // ex: "myLink myLink-url", "myLink myLink-email", "myLink myLink-phone", "myLink myLink-twitter", or "myLink myLink-hashtag"
	},


	/**
	 * Processes the `anchorText` by truncating the text according to the
	 * {@link #truncate} config.
	 *
	 * @private
	 * @param {String} anchorText The anchor tag's text (i.e. what will be
	 *   displayed).
	 * @return {String} The processed `anchorText`.
	 */
	processAnchorText : function( anchorText ) {
		anchorText = this.doTruncate( anchorText );

		return anchorText;
	},


	/**
	 * Performs the truncation of the `anchorText` based on the {@link #truncate}
	 * option. If the `anchorText` is longer than the length specified by the
	 * {@link #truncate} option, the truncation is performed based on the
	 * `location` property. See {@link #truncate} for details.
	 *
	 * @private
	 * @param {String} anchorText The anchor tag's text (i.e. what will be
	 *   displayed).
	 * @return {String} The truncated anchor text.
	 */
	doTruncate : function( anchorText ) {
		var truncate = this.truncate;
		if( !truncate || !truncate.length ) return anchorText;

		var truncateLength = truncate.length,
			truncateLocation = truncate.location;

		if( truncateLocation === 'smart' ) {
			return Autolinker.truncate.TruncateSmart( anchorText, truncateLength, '..' );

		} else if( truncateLocation === 'middle' ) {
			return Autolinker.truncate.TruncateMiddle( anchorText, truncateLength, '..' );

		} else {
			return Autolinker.truncate.TruncateEnd( anchorText, truncateLength, '..' );
		}
	}

} );

/*global Autolinker */
/**
 * @class Autolinker.htmlParser.HtmlParser
 * @extends Object
 *
 * An HTML parser implementation which simply walks an HTML string and returns an array of
 * {@link Autolinker.htmlParser.HtmlNode HtmlNodes} that represent the basic HTML structure of the input string.
 *
 * Autolinker uses this to only link URLs/emails/Twitter handles within text nodes, effectively ignoring / "walking
 * around" HTML tags.
 */
Autolinker.htmlParser.HtmlParser = Autolinker.Util.extend( Object, {

	/**
	 * @private
	 * @property {RegExp} htmlRegex
	 *
	 * The regular expression used to pull out HTML tags from a string. Handles namespaced HTML tags and
	 * attribute names, as specified by http://www.w3.org/TR/html-markup/syntax.html.
	 *
	 * Capturing groups:
	 *
	 * 1. The "!DOCTYPE" tag name, if a tag is a &lt;!DOCTYPE&gt; tag.
	 * 2. If it is an end tag, this group will have the '/'.
	 * 3. If it is a comment tag, this group will hold the comment text (i.e.
	 *    the text inside the `&lt;!--` and `--&gt;`.
	 * 4. The tag name for all tags (other than the &lt;!DOCTYPE&gt; tag)
	 */
	htmlRegex : (function() {
		var commentTagRegex = /!--([\s\S]+?)--/,
		    tagNameRegex = /[0-9a-zA-Z][0-9a-zA-Z:]*/,
		    attrNameRegex = /[^\s\0"'>\/=\x01-\x1F\x7F]+/,   // the unicode range accounts for excluding control chars, and the delete char
		    attrValueRegex = /(?:"[^"]*?"|'[^']*?'|[^'"=<>`\s]+)/, // double quoted, single quoted, or unquoted attribute values
		    nameEqualsValueRegex = attrNameRegex.source + '(?:\\s*=\\s*' + attrValueRegex.source + ')?';  // optional '=[value]'

		return new RegExp( [
			// for <!DOCTYPE> tag. Ex: <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">)
			'(?:',
				'<(!DOCTYPE)',  // *** Capturing Group 1 - If it's a doctype tag

					// Zero or more attributes following the tag name
					'(?:',
						'\\s+',  // one or more whitespace chars before an attribute

						// Either:
						// A. attr="value", or
						// B. "value" alone (To cover example doctype tag: <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">)
						'(?:', nameEqualsValueRegex, '|', attrValueRegex.source + ')',
					')*',
				'>',
			')',

			'|',

			// All other HTML tags (i.e. tags that are not <!DOCTYPE>)
			'(?:',
				'<(/)?',  // Beginning of a tag or comment. Either '<' for a start tag, or '</' for an end tag.
				          // *** Capturing Group 2: The slash or an empty string. Slash ('/') for end tag, empty string for start or self-closing tag.

					'(?:',
						commentTagRegex.source,  // *** Capturing Group 3 - A Comment Tag's Text

						'|',

						'(?:',

							// *** Capturing Group 4 - The tag name
							'(' + tagNameRegex.source + ')',

							// Zero or more attributes following the tag name
							'(?:',
								'\\s*',                // any number of whitespace chars before an attribute
								nameEqualsValueRegex,  // attr="value" (with optional ="value" part)
							')*',

							'\\s*/?',  // any trailing spaces and optional '/' before the closing '>'

						')',
					')',
				'>',
			')'
		].join( "" ), 'gi' );
	} )(),

	/**
	 * @private
	 * @property {RegExp} htmlCharacterEntitiesRegex
	 *
	 * The regular expression that matches common HTML character entities.
	 *
	 * Ignoring &amp; as it could be part of a query string -- handling it separately.
	 */
	htmlCharacterEntitiesRegex: /(&nbsp;|&#160;|&lt;|&#60;|&gt;|&#62;|&quot;|&#34;|&#39;)/gi,


	/**
	 * Parses an HTML string and returns a simple array of {@link Autolinker.htmlParser.HtmlNode HtmlNodes}
	 * to represent the HTML structure of the input string.
	 *
	 * @param {String} html The HTML to parse.
	 * @return {Autolinker.htmlParser.HtmlNode[]}
	 */
	parse : function( html ) {
		var htmlRegex = this.htmlRegex,
		    currentResult,
		    lastIndex = 0,
		    textAndEntityNodes,
		    nodes = [];  // will be the result of the method

		while( ( currentResult = htmlRegex.exec( html ) ) !== null ) {
			var tagText = currentResult[ 0 ],
			    commentText = currentResult[ 3 ], // if we've matched a comment
			    tagName = currentResult[ 1 ] || currentResult[ 4 ],  // The <!DOCTYPE> tag (ex: "!DOCTYPE"), or another tag (ex: "a" or "img")
			    isClosingTag = !!currentResult[ 2 ],
			    offset = currentResult.index,
			    inBetweenTagsText = html.substring( lastIndex, offset );

			// Push TextNodes and EntityNodes for any text found between tags
			if( inBetweenTagsText ) {
				textAndEntityNodes = this.parseTextAndEntityNodes( lastIndex, inBetweenTagsText );
				nodes.push.apply( nodes, textAndEntityNodes );
			}

			// Push the CommentNode or ElementNode
			if( commentText ) {
				nodes.push( this.createCommentNode( offset, tagText, commentText ) );
			} else {
				nodes.push( this.createElementNode( offset, tagText, tagName, isClosingTag ) );
			}

			lastIndex = offset + tagText.length;
		}

		// Process any remaining text after the last HTML element. Will process all of the text if there were no HTML elements.
		if( lastIndex < html.length ) {
			var text = html.substring( lastIndex );

			// Push TextNodes and EntityNodes for any text found between tags
			if( text ) {
				textAndEntityNodes = this.parseTextAndEntityNodes( lastIndex, text );
				nodes.push.apply( nodes, textAndEntityNodes );
			}
		}

		return nodes;
	},


	/**
	 * Parses text and HTML entity nodes from a given string. The input string
	 * should not have any HTML tags (elements) within it.
	 *
	 * @private
	 * @param {Number} offset The offset of the text node match within the
	 *   original HTML string.
	 * @param {String} text The string of text to parse. This is from an HTML
	 *   text node.
	 * @return {Autolinker.htmlParser.HtmlNode[]} An array of HtmlNodes to
	 *   represent the {@link Autolinker.htmlParser.TextNode TextNodes} and
	 *   {@link Autolinker.htmlParser.EntityNode EntityNodes} found.
	 */
	parseTextAndEntityNodes : function( offset, text ) {
		var nodes = [],
		    textAndEntityTokens = Autolinker.Util.splitAndCapture( text, this.htmlCharacterEntitiesRegex );  // split at HTML entities, but include the HTML entities in the results array

		// Every even numbered token is a TextNode, and every odd numbered token is an EntityNode
		// For example: an input `text` of "Test &quot;this&quot; today" would turn into the
		//   `textAndEntityTokens`: [ 'Test ', '&quot;', 'this', '&quot;', ' today' ]
		for( var i = 0, len = textAndEntityTokens.length; i < len; i += 2 ) {
			var textToken = textAndEntityTokens[ i ],
			    entityToken = textAndEntityTokens[ i + 1 ];

			if( textToken ) {
				nodes.push( this.createTextNode( offset, textToken ) );
				offset += textToken.length;
			}
			if( entityToken ) {
				nodes.push( this.createEntityNode( offset, entityToken ) );
				offset += entityToken.length;
			}
		}
		return nodes;
	},


	/**
	 * Factory method to create an {@link Autolinker.htmlParser.CommentNode CommentNode}.
	 *
	 * @private
	 * @param {Number} offset The offset of the match within the original HTML
	 *   string.
	 * @param {String} tagText The full text of the tag (comment) that was
	 *   matched, including its &lt;!-- and --&gt;.
	 * @param {String} commentText The full text of the comment that was matched.
	 */
	createCommentNode : function( offset, tagText, commentText ) {
		return new Autolinker.htmlParser.CommentNode( {
			offset : offset,
			text   : tagText,
			comment: Autolinker.Util.trim( commentText )
		} );
	},


	/**
	 * Factory method to create an {@link Autolinker.htmlParser.ElementNode ElementNode}.
	 *
	 * @private
	 * @param {Number} offset The offset of the match within the original HTML
	 *   string.
	 * @param {String} tagText The full text of the tag (element) that was
	 *   matched, including its attributes.
	 * @param {String} tagName The name of the tag. Ex: An &lt;img&gt; tag would
	 *   be passed to this method as "img".
	 * @param {Boolean} isClosingTag `true` if it's a closing tag, false
	 *   otherwise.
	 * @return {Autolinker.htmlParser.ElementNode}
	 */
	createElementNode : function( offset, tagText, tagName, isClosingTag ) {
		return new Autolinker.htmlParser.ElementNode( {
			offset  : offset,
			text    : tagText,
			tagName : tagName.toLowerCase(),
			closing : isClosingTag
		} );
	},


	/**
	 * Factory method to create a {@link Autolinker.htmlParser.EntityNode EntityNode}.
	 *
	 * @private
	 * @param {Number} offset The offset of the match within the original HTML
	 *   string.
	 * @param {String} text The text that was matched for the HTML entity (such
	 *   as '&amp;nbsp;').
	 * @return {Autolinker.htmlParser.EntityNode}
	 */
	createEntityNode : function( offset, text ) {
		return new Autolinker.htmlParser.EntityNode( { offset: offset, text: text } );
	},


	/**
	 * Factory method to create a {@link Autolinker.htmlParser.TextNode TextNode}.
	 *
	 * @private
	 * @param {Number} offset The offset of the match within the original HTML
	 *   string.
	 * @param {String} text The text that was matched.
	 * @return {Autolinker.htmlParser.TextNode}
	 */
	createTextNode : function( offset, text ) {
		return new Autolinker.htmlParser.TextNode( { offset: offset, text: text } );
	}

} );
/*global Autolinker */
/**
 * @abstract
 * @class Autolinker.htmlParser.HtmlNode
 *
 * Represents an HTML node found in an input string. An HTML node is one of the
 * following:
 *
 * 1. An {@link Autolinker.htmlParser.ElementNode ElementNode}, which represents
 *    HTML tags.
 * 2. A {@link Autolinker.htmlParser.CommentNode CommentNode}, which represents
 *    HTML comments.
 * 3. A {@link Autolinker.htmlParser.TextNode TextNode}, which represents text
 *    outside or within HTML tags.
 * 4. A {@link Autolinker.htmlParser.EntityNode EntityNode}, which represents
 *    one of the known HTML entities that Autolinker looks for. This includes
 *    common ones such as &amp;quot; and &amp;nbsp;
 */
Autolinker.htmlParser.HtmlNode = Autolinker.Util.extend( Object, {

	/**
	 * @cfg {Number} offset (required)
	 *
	 * The offset of the HTML node in the original text that was parsed.
	 */
	offset : undefined,

	/**
	 * @cfg {String} text (required)
	 *
	 * The text that was matched for the HtmlNode.
	 *
	 * - In the case of an {@link Autolinker.htmlParser.ElementNode ElementNode},
	 *   this will be the tag's text.
	 * - In the case of an {@link Autolinker.htmlParser.CommentNode CommentNode},
	 *   this will be the comment's text.
	 * - In the case of a {@link Autolinker.htmlParser.TextNode TextNode}, this
	 *   will be the text itself.
	 * - In the case of a {@link Autolinker.htmlParser.EntityNode EntityNode},
	 *   this will be the text of the HTML entity.
	 */
	text : undefined,


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match instance,
	 * specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.Util.assign( this, cfg );

		if( this.offset == null ) throw new Error( '`offset` cfg required' );
		if( this.text == null ) throw new Error( '`text` cfg required' );
	},


	/**
	 * Returns a string name for the type of node that this class represents.
	 *
	 * @abstract
	 * @return {String}
	 */
	getType : Autolinker.Util.abstractMethod,


	/**
	 * Retrieves the {@link #offset} of the HtmlNode. This is the offset of the
	 * HTML node in the original string that was parsed.
	 *
	 * @return {Number}
	 */
	getOffset : function() {
		return this.offset;
	},


	/**
	 * Retrieves the {@link #text} for the HtmlNode.
	 *
	 * @return {String}
	 */
	getText : function() {
		return this.text;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.htmlParser.CommentNode
 * @extends Autolinker.htmlParser.HtmlNode
 *
 * Represents an HTML comment node that has been parsed by the
 * {@link Autolinker.htmlParser.HtmlParser}.
 *
 * See this class's superclass ({@link Autolinker.htmlParser.HtmlNode}) for more
 * details.
 */
Autolinker.htmlParser.CommentNode = Autolinker.Util.extend( Autolinker.htmlParser.HtmlNode, {

	/**
	 * @cfg {String} comment (required)
	 *
	 * The text inside the comment tag. This text is stripped of any leading or
	 * trailing whitespace.
	 */
	comment : '',


	/**
	 * Returns a string name for the type of node that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'comment';
	},


	/**
	 * Returns the comment inside the comment tag.
	 *
	 * @return {String}
	 */
	getComment : function() {
		return this.comment;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.htmlParser.ElementNode
 * @extends Autolinker.htmlParser.HtmlNode
 *
 * Represents an HTML element node that has been parsed by the {@link Autolinker.htmlParser.HtmlParser}.
 *
 * See this class's superclass ({@link Autolinker.htmlParser.HtmlNode}) for more
 * details.
 */
Autolinker.htmlParser.ElementNode = Autolinker.Util.extend( Autolinker.htmlParser.HtmlNode, {

	/**
	 * @cfg {String} tagName (required)
	 *
	 * The name of the tag that was matched.
	 */
	tagName : '',

	/**
	 * @cfg {Boolean} closing (required)
	 *
	 * `true` if the element (tag) is a closing tag, `false` if its an opening
	 * tag.
	 */
	closing : false,


	/**
	 * Returns a string name for the type of node that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'element';
	},


	/**
	 * Returns the HTML element's (tag's) name. Ex: for an &lt;img&gt; tag,
	 * returns "img".
	 *
	 * @return {String}
	 */
	getTagName : function() {
		return this.tagName;
	},


	/**
	 * Determines if the HTML element (tag) is a closing tag. Ex: &lt;div&gt;
	 * returns `false`, while &lt;/div&gt; returns `true`.
	 *
	 * @return {Boolean}
	 */
	isClosing : function() {
		return this.closing;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.htmlParser.EntityNode
 * @extends Autolinker.htmlParser.HtmlNode
 *
 * Represents a known HTML entity node that has been parsed by the {@link Autolinker.htmlParser.HtmlParser}.
 * Ex: '&amp;nbsp;', or '&amp#160;' (which will be retrievable from the {@link #getText}
 * method.
 *
 * Note that this class will only be returned from the HtmlParser for the set of
 * checked HTML entity nodes  defined by the {@link Autolinker.htmlParser.HtmlParser#htmlCharacterEntitiesRegex}.
 *
 * See this class's superclass ({@link Autolinker.htmlParser.HtmlNode}) for more
 * details.
 */
Autolinker.htmlParser.EntityNode = Autolinker.Util.extend( Autolinker.htmlParser.HtmlNode, {

	/**
	 * Returns a string name for the type of node that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'entity';
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.htmlParser.TextNode
 * @extends Autolinker.htmlParser.HtmlNode
 *
 * Represents a text node that has been parsed by the {@link Autolinker.htmlParser.HtmlParser}.
 *
 * See this class's superclass ({@link Autolinker.htmlParser.HtmlNode}) for more
 * details.
 */
Autolinker.htmlParser.TextNode = Autolinker.Util.extend( Autolinker.htmlParser.HtmlNode, {

	/**
	 * Returns a string name for the type of node that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'text';
	}

} );
/*global Autolinker */
/**
 * @abstract
 * @class Autolinker.match.Match
 *
 * Represents a match found in an input string which should be Autolinked. A Match object is what is provided in a
 * {@link Autolinker#replaceFn replaceFn}, and may be used to query for details about the match.
 *
 * For example:
 *
 *     var input = "...";  // string with URLs, Email Addresses, and Twitter Handles
 *
 *     var linkedText = Autolinker.link( input, {
 *         replaceFn : function( autolinker, match ) {
 *             console.log( "href = ", match.getAnchorHref() );
 *             console.log( "text = ", match.getAnchorText() );
 *
 *             switch( match.getType() ) {
 *                 case 'url' :
 *                     console.log( "url: ", match.getUrl() );
 *
 *                 case 'email' :
 *                     console.log( "email: ", match.getEmail() );
 *
 *                 case 'twitter' :
 *                     console.log( "twitter: ", match.getTwitterHandle() );
 *             }
 *         }
 *     } );
 *
 * See the {@link Autolinker} class for more details on using the {@link Autolinker#replaceFn replaceFn}.
 */
Autolinker.match.Match = Autolinker.Util.extend( Object, {

	/**
	 * @cfg {Autolinker.AnchorTagBuilder} tagBuilder (required)
	 *
	 * Reference to the AnchorTagBuilder instance to use to generate an anchor
	 * tag for the Match.
	 */

	/**
	 * @cfg {String} matchedText (required)
	 *
	 * The original text that was matched by the {@link Autolinker.matcher.Matcher}.
	 */

	/**
	 * @cfg {Number} offset (required)
	 *
	 * The offset of where the match was made in the input string.
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		if( cfg.tagBuilder == null ) throw new Error( '`tagBuilder` cfg required' );
		if( cfg.matchedText == null ) throw new Error( '`matchedText` cfg required' );
		if( cfg.offset == null ) throw new Error( '`offset` cfg required' );

		this.tagBuilder = cfg.tagBuilder;
		this.matchedText = cfg.matchedText;
		this.offset = cfg.offset;
	},


	/**
	 * Returns a string name for the type of match that this class represents.
	 *
	 * @abstract
	 * @return {String}
	 */
	getType : Autolinker.Util.abstractMethod,


	/**
	 * Returns the original text that was matched.
	 *
	 * @return {String}
	 */
	getMatchedText : function() {
		return this.matchedText;
	},


	/**
	 * Sets the {@link #offset} of where the match was made in the input string.
	 *
	 * A {@link Autolinker.matcher.Matcher} will be fed only HTML text nodes,
	 * and will therefore set an original offset that is relative to the HTML
	 * text node itself. However, we want this offset to be relative to the full
	 * HTML input string, and thus if using {@link Autolinker#parse} (rather
	 * than calling a {@link Autolinker.matcher.Matcher} directly), then this
	 * offset is corrected after the Matcher itself has done its job.
	 *
	 * @param {Number} offset
	 */
	setOffset : function( offset ) {
		this.offset = offset;
	},


	/**
	 * Returns the offset of where the match was made in the input string. This
	 * is the 0-based index of the match.
	 *
	 * @return {Number}
	 */
	getOffset : function() {
		return this.offset;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @abstract
	 * @return {String}
	 */
	getAnchorHref : Autolinker.Util.abstractMethod,


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @abstract
	 * @return {String}
	 */
	getAnchorText : Autolinker.Util.abstractMethod,


	/**
	 * Builds and returns an {@link Autolinker.HtmlTag} instance based on the
	 * Match.
	 *
	 * This can be used to easily generate anchor tags from matches, and either
	 * return their HTML string, or modify them before doing so.
	 *
	 * Example Usage:
	 *
	 *     var tag = match.buildTag();
	 *     tag.addClass( 'cordova-link' );
	 *     tag.setAttr( 'target', '_system' );
	 *
	 *     tag.toAnchorString();  // <a href="http://google.com" class="cordova-link" target="_system">Google</a>
	 */
	buildTag : function() {
		return this.tagBuilder.build( this );
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.match.Email
 * @extends Autolinker.match.Match
 *
 * Represents a Email match found in an input string which should be Autolinked.
 *
 * See this class's superclass ({@link Autolinker.match.Match}) for more details.
 */
Autolinker.match.Email = Autolinker.Util.extend( Autolinker.match.Match, {

	/**
	 * @cfg {String} email (required)
	 *
	 * The email address that was matched.
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.match.Match.prototype.constructor.call( this, cfg );

		if( !cfg.email ) throw new Error( '`email` cfg required' );

		this.email = cfg.email;
	},


	/**
	 * Returns a string name for the type of match that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'email';
	},


	/**
	 * Returns the email address that was matched.
	 *
	 * @return {String}
	 */
	getEmail : function() {
		return this.email;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorHref : function() {
		return 'mailto:' + this.email;
	},


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorText : function() {
		return this.email;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.match.Hashtag
 * @extends Autolinker.match.Match
 *
 * Represents a Hashtag match found in an input string which should be
 * Autolinked.
 *
 * See this class's superclass ({@link Autolinker.match.Match}) for more
 * details.
 */
Autolinker.match.Hashtag = Autolinker.Util.extend( Autolinker.match.Match, {

	/**
	 * @cfg {String} serviceName
	 *
	 * The service to point hashtag matches to. See {@link Autolinker#hashtag}
	 * for available values.
	 */

	/**
	 * @cfg {String} hashtag (required)
	 *
	 * The Hashtag that was matched, without the '#'.
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.match.Match.prototype.constructor.call( this, cfg );

		// TODO: if( !serviceName ) throw new Error( '`serviceName` cfg required' );
		if( !cfg.hashtag ) throw new Error( '`hashtag` cfg required' );

		this.serviceName = cfg.serviceName;
		this.hashtag = cfg.hashtag;
	},


	/**
	 * Returns the type of match that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'hashtag';
	},


	/**
	 * Returns the configured {@link #serviceName} to point the Hashtag to.
	 * Ex: 'facebook', 'twitter'.
	 *
	 * @return {String}
	 */
	getServiceName : function() {
		return this.serviceName;
	},


	/**
	 * Returns the matched hashtag, without the '#' character.
	 *
	 * @return {String}
	 */
	getHashtag : function() {
		return this.hashtag;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorHref : function() {
		var serviceName = this.serviceName,
		    hashtag = this.hashtag;

		switch( serviceName ) {
			case 'twitter' :
				return 'https://twitter.com/hashtag/' + hashtag;
			case 'facebook' :
				return 'https://www.facebook.com/hashtag/' + hashtag;
			case 'instagram' :
				return 'https://instagram.com/explore/tags/' + hashtag;

			default :  // Shouldn't happen because Autolinker's constructor should block any invalid values, but just in case.
				throw new Error( 'Unknown service name to point hashtag to: ', serviceName );
		}
	},


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorText : function() {
		return '#' + this.hashtag;
	}

} );

/*global Autolinker */
/**
 * @class Autolinker.match.Phone
 * @extends Autolinker.match.Match
 *
 * Represents a Phone number match found in an input string which should be
 * Autolinked.
 *
 * See this class's superclass ({@link Autolinker.match.Match}) for more
 * details.
 */
Autolinker.match.Phone = Autolinker.Util.extend( Autolinker.match.Match, {

	/**
	 * @protected
	 * @property {String} number (required)
	 *
	 * The phone number that was matched, without any delimiter characters.
	 *
	 * Note: This is a string to allow for prefixed 0's.
	 */

	/**
	 * @protected
	 * @property  {Boolean} plusSign (required)
	 *
	 * `true` if the matched phone number started with a '+' sign. We'll include
	 * it in the `tel:` URL if so, as this is needed for international numbers.
	 *
	 * Ex: '+1 (123) 456 7879'
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.match.Match.prototype.constructor.call( this, cfg );

		if( !cfg.number ) throw new Error( '`number` cfg required' );
		if( cfg.plusSign == null ) throw new Error( '`plusSign` cfg required' );

		this.number = cfg.number;
		this.plusSign = cfg.plusSign;
	},


	/**
	 * Returns a string name for the type of match that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'phone';
	},


	/**
	 * Returns the phone number that was matched as a string, without any
	 * delimiter characters.
	 *
	 * Note: This is a string to allow for prefixed 0's.
	 *
	 * @return {String}
	 */
	getNumber: function() {
		return this.number;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorHref : function() {
		return 'tel:' + ( this.plusSign ? '+' : '' ) + this.number;
	},


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorText : function() {
		return this.matchedText;
	}

} );

/*global Autolinker */
/**
 * @class Autolinker.match.Twitter
 * @extends Autolinker.match.Match
 *
 * Represents a Twitter match found in an input string which should be Autolinked.
 *
 * See this class's superclass ({@link Autolinker.match.Match}) for more details.
 */
Autolinker.match.Twitter = Autolinker.Util.extend( Autolinker.match.Match, {

	/**
	 * @cfg {String} twitterHandle (required)
	 *
	 * The Twitter handle that was matched, without the '@' character.
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg) {
		Autolinker.match.Match.prototype.constructor.call( this, cfg );

		if( !cfg.twitterHandle ) throw new Error( '`twitterHandle` cfg required' );

		this.twitterHandle = cfg.twitterHandle;
	},


	/**
	 * Returns the type of match that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'twitter';
	},


	/**
	 * Returns the twitter handle, without the '@' character.
	 *
	 * @return {String}
	 */
	getTwitterHandle : function() {
		return this.twitterHandle;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorHref : function() {
		return 'https://twitter.com/' + this.twitterHandle;
	},


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorText : function() {
		return '@' + this.twitterHandle;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.match.Url
 * @extends Autolinker.match.Match
 *
 * Represents a Url match found in an input string which should be Autolinked.
 *
 * See this class's superclass ({@link Autolinker.match.Match}) for more details.
 */
Autolinker.match.Url = Autolinker.Util.extend( Autolinker.match.Match, {

	/**
	 * @cfg {String} url (required)
	 *
	 * The url that was matched.
	 */

	/**
	 * @cfg {"scheme"/"www"/"tld"} urlMatchType (required)
	 *
	 * The type of URL match that this class represents. This helps to determine
	 * if the match was made in the original text with a prefixed scheme (ex:
	 * 'http://www.google.com'), a prefixed 'www' (ex: 'www.google.com'), or
	 * was matched by a known top-level domain (ex: 'google.com').
	 */

	/**
	 * @cfg {Boolean} protocolUrlMatch (required)
	 *
	 * `true` if the URL is a match which already has a protocol (i.e.
	 * 'http://'), `false` if the match was from a 'www' or known TLD match.
	 */

	/**
	 * @cfg {Boolean} protocolRelativeMatch (required)
	 *
	 * `true` if the URL is a protocol-relative match. A protocol-relative match
	 * is a URL that starts with '//', and will be either http:// or https://
	 * based on the protocol that the site is loaded under.
	 */

	/**
	 * @cfg {Boolean} stripPrefix (required)
	 * @inheritdoc Autolinker#cfg-stripPrefix
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.match.Match.prototype.constructor.call( this, cfg );

		if( cfg.urlMatchType !== 'scheme' && cfg.urlMatchType !== 'www' && cfg.urlMatchType !== 'tld' ) throw new Error( '`urlMatchType` cfg must be one of: "scheme", "www", or "tld"' );
		if( !cfg.url ) throw new Error( '`url` cfg required' );
		if( cfg.protocolUrlMatch == null ) throw new Error( '`protocolUrlMatch` cfg required' );
		if( cfg.protocolRelativeMatch == null ) throw new Error( '`protocolRelativeMatch` cfg required' );
		if( cfg.stripPrefix == null ) throw new Error( '`stripPrefix` cfg required' );

		this.urlMatchType = cfg.urlMatchType;
		this.url = cfg.url;
		this.protocolUrlMatch = cfg.protocolUrlMatch;
		this.protocolRelativeMatch = cfg.protocolRelativeMatch;
		this.stripPrefix = cfg.stripPrefix;
	},


	/**
	 * @private
	 * @property {RegExp} urlPrefixRegex
	 *
	 * A regular expression used to remove the 'http://' or 'https://' and/or the 'www.' from URLs.
	 */
	urlPrefixRegex: /^(https?:\/\/)?(www\.)?/i,

	/**
	 * @private
	 * @property {RegExp} protocolRelativeRegex
	 *
	 * The regular expression used to remove the protocol-relative '//' from the {@link #url} string, for purposes
	 * of {@link #getAnchorText}. A protocol-relative URL is, for example, "//yahoo.com"
	 */
	protocolRelativeRegex : /^\/\//,

	/**
	 * @private
	 * @property {Boolean} protocolPrepended
	 *
	 * Will be set to `true` if the 'http://' protocol has been prepended to the {@link #url} (because the
	 * {@link #url} did not have a protocol)
	 */
	protocolPrepended : false,


	/**
	 * Returns a string name for the type of match that this class represents.
	 *
	 * @return {String}
	 */
	getType : function() {
		return 'url';
	},


	/**
	 * Returns a string name for the type of URL match that this class
	 * represents.
	 *
	 * This helps to determine if the match was made in the original text with a
	 * prefixed scheme (ex: 'http://www.google.com'), a prefixed 'www' (ex:
	 * 'www.google.com'), or was matched by a known top-level domain (ex:
	 * 'google.com').
	 *
	 * @return {"scheme"/"www"/"tld"}
	 */
	getUrlMatchType : function() {
		return this.urlMatchType;
	},


	/**
	 * Returns the url that was matched, assuming the protocol to be 'http://' if the original
	 * match was missing a protocol.
	 *
	 * @return {String}
	 */
	getUrl : function() {
		var url = this.url;

		// if the url string doesn't begin with a protocol, assume 'http://'
		if( !this.protocolRelativeMatch && !this.protocolUrlMatch && !this.protocolPrepended ) {
			url = this.url = 'http://' + url;

			this.protocolPrepended = true;
		}

		return url;
	},


	/**
	 * Returns the anchor href that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorHref : function() {
		var url = this.getUrl();

		return url.replace( /&amp;/g, '&' );  // any &amp;'s in the URL should be converted back to '&' if they were displayed as &amp; in the source html
	},


	/**
	 * Returns the anchor text that should be generated for the match.
	 *
	 * @return {String}
	 */
	getAnchorText : function() {
		var anchorText = this.getMatchedText();

		if( this.protocolRelativeMatch ) {
			// Strip off any protocol-relative '//' from the anchor text
			anchorText = this.stripProtocolRelativePrefix( anchorText );
		}
		if( this.stripPrefix ) {
			anchorText = this.stripUrlPrefix( anchorText );
		}
		anchorText = this.removeTrailingSlash( anchorText );  // remove trailing slash, if there is one

		return anchorText;
	},


	// ---------------------------------------

	// Utility Functionality

	/**
	 * Strips the URL prefix (such as "http://" or "https://") from the given text.
	 *
	 * @private
	 * @param {String} text The text of the anchor that is being generated, for which to strip off the
	 *   url prefix (such as stripping off "http://")
	 * @return {String} The `anchorText`, with the prefix stripped.
	 */
	stripUrlPrefix : function( text ) {
		return text.replace( this.urlPrefixRegex, '' );
	},


	/**
	 * Strips any protocol-relative '//' from the anchor text.
	 *
	 * @private
	 * @param {String} text The text of the anchor that is being generated, for which to strip off the
	 *   protocol-relative prefix (such as stripping off "//")
	 * @return {String} The `anchorText`, with the protocol-relative prefix stripped.
	 */
	stripProtocolRelativePrefix : function( text ) {
		return text.replace( this.protocolRelativeRegex, '' );
	},


	/**
	 * Removes any trailing slash from the given `anchorText`, in preparation for the text to be displayed.
	 *
	 * @private
	 * @param {String} anchorText The text of the anchor that is being generated, for which to remove any trailing
	 *   slash ('/') that may exist.
	 * @return {String} The `anchorText`, with the trailing slash removed.
	 */
	removeTrailingSlash : function( anchorText ) {
		if( anchorText.charAt( anchorText.length - 1 ) === '/' ) {
			anchorText = anchorText.slice( 0, -1 );
		}
		return anchorText;
	}

} );
/*global Autolinker */
/**
 * @abstract
 * @class Autolinker.matcher.Matcher
 *
 * An abstract class and interface for individual matchers to find matches in
 * an input string with linkified versions of them.
 *
 * Note that Matchers do not take HTML into account - they must be fed the text
 * nodes of any HTML string, which is handled by {@link Autolinker#parse}.
 */
Autolinker.matcher.Matcher = Autolinker.Util.extend( Object, {

	/**
	 * @cfg {Autolinker.AnchorTagBuilder} tagBuilder (required)
	 *
	 * Reference to the AnchorTagBuilder instance to use to generate HTML tags
	 * for {@link Autolinker.match.Match Matches}.
	 */


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Matcher
	 *   instance, specified in an Object (map).
	 */
	constructor : function( cfg ) {
		if( !cfg.tagBuilder ) throw new Error( '`tagBuilder` cfg required' );

		this.tagBuilder = cfg.tagBuilder;
	},


	/**
	 * Parses the input `text` and returns the array of {@link Autolinker.match.Match Matches}
	 * for the matcher.
	 *
	 * @abstract
	 * @param {String} text The text to scan and replace matches in.
	 * @return {Autolinker.match.Match[]}
	 */
	parseMatches : Autolinker.Util.abstractMethod

} );
/*global Autolinker */
/**
 * @class Autolinker.matcher.Email
 * @extends Autolinker.matcher.Matcher
 *
 * Matcher to find email matches in an input string.
 *
 * See this class's superclass ({@link Autolinker.matcher.Matcher}) for more details.
 */
Autolinker.matcher.Email = Autolinker.Util.extend( Autolinker.matcher.Matcher, {

	/**
	 * The regular expression to match email addresses. Example match:
	 *
	 *     person@place.com
	 *
	 * @private
	 * @property {RegExp} matcherRegex
	 */
	matcherRegex : (function() {
		var alphaNumericChars = Autolinker.RegexLib.alphaNumericCharsStr,
		    emailRegex = new RegExp( '[' + alphaNumericChars + '\\-;:&=+$.,]+@' ),  // something@ for email addresses (a.k.a. local-part)
			domainNameRegex = Autolinker.RegexLib.domainNameRegex,
			tldRegex = Autolinker.RegexLib.tldRegex;  // match our known top level domains (TLDs)

		return new RegExp( [
			emailRegex.source,
			domainNameRegex.source,
			'\\.', tldRegex.source   // '.com', '.net', etc
		].join( "" ), 'gi' );
	} )(),


	/**
	 * @inheritdoc
	 */
	parseMatches : function( text ) {
		var matcherRegex = this.matcherRegex,
		    tagBuilder = this.tagBuilder,
		    matches = [],
		    match;

		while( ( match = matcherRegex.exec( text ) ) !== null ) {
			var matchedText = match[ 0 ];

			matches.push( new Autolinker.match.Email( {
				tagBuilder  : tagBuilder,
				matchedText : matchedText,
				offset      : match.index,
				email       : matchedText
			} ) );
		}

		return matches;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.matcher.Hashtag
 * @extends Autolinker.matcher.Matcher
 *
 * Matcher to find Hashtag matches in an input string.
 */
Autolinker.matcher.Hashtag = Autolinker.Util.extend( Autolinker.matcher.Matcher, {

	/**
	 * @cfg {String} serviceName
	 *
	 * The service to point hashtag matches to. See {@link Autolinker#hashtag}
	 * for available values.
	 */


	/**
	 * The regular expression to match Hashtags. Example match:
	 *
	 *     #asdf
	 *
	 * @private
	 * @property {RegExp} matcherRegex
	 */
	matcherRegex : new RegExp( '#[_' + Autolinker.RegexLib.alphaNumericCharsStr + ']{1,139}', 'g' ),

	/**
	 * The regular expression to use to check the character before a username match to
	 * make sure we didn't accidentally match an email address.
	 *
	 * For example, the string "asdf@asdf.com" should not match "@asdf" as a username.
	 *
	 * @private
	 * @property {RegExp} nonWordCharRegex
	 */
	nonWordCharRegex : new RegExp( '[^' + Autolinker.RegexLib.alphaNumericCharsStr + ']' ),


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match instance,
	 *   specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.matcher.Matcher.prototype.constructor.call( this, cfg );

		this.serviceName = cfg.serviceName;
	},


	/**
	 * @inheritdoc
	 */
	parseMatches : function( text ) {
		var matcherRegex = this.matcherRegex,
		    nonWordCharRegex = this.nonWordCharRegex,
		    serviceName = this.serviceName,
		    tagBuilder = this.tagBuilder,
		    matches = [],
		    match;

		while( ( match = matcherRegex.exec( text ) ) !== null ) {
			var offset = match.index,
			    prevChar = text.charAt( offset - 1 );

			// If we found the match at the beginning of the string, or we found the match
			// and there is a whitespace char in front of it (meaning it is not a '#' char
			// in the middle of a word), then it is a hashtag match.
			if( offset === 0 || nonWordCharRegex.test( prevChar ) ) {
				var matchedText = match[ 0 ],
				    hashtag = match[ 0 ].slice( 1 );  // strip off the '#' character at the beginning

				matches.push( new Autolinker.match.Hashtag( {
					tagBuilder  : tagBuilder,
					matchedText : matchedText,
					offset      : offset,
					serviceName : serviceName,
					hashtag     : hashtag
				} ) );
			}
		}

		return matches;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.matcher.Phone
 * @extends Autolinker.matcher.Matcher
 *
 * Matcher to find Phone number matches in an input string.
 *
 * See this class's superclass ({@link Autolinker.matcher.Matcher}) for more
 * details.
 */
Autolinker.matcher.Phone = Autolinker.Util.extend( Autolinker.matcher.Matcher, {

	/**
	 * The regular expression to match Phone numbers. Example match:
	 *
	 *     (123) 456-7890
	 *
	 * This regular expression has the following capturing groups:
	 *
	 * 1. The prefixed '+' sign, if there is one.
	 *
	 * @private
	 * @property {RegExp} matcherRegex
	 */
	matcherRegex : /(?:(\+)?\d{1,3}[-\040.])?\(?\d{3}\)?[-\040.]?\d{3}[-\040.]\d{4}/g,  // ex: (123) 456-7890, 123 456 7890, 123-456-7890, etc.

	/**
	 * @inheritdoc
	 */
	parseMatches : function( text ) {
		var matcherRegex = this.matcherRegex,
		    tagBuilder = this.tagBuilder,
		    matches = [],
		    match;

		while( ( match = matcherRegex.exec( text ) ) !== null ) {
			// Remove non-numeric values from phone number string
			var matchedText = match[ 0 ],
			    cleanNumber = matchedText.replace( /\D/g, '' ),  // strip out non-digit characters
			    plusSign = !!match[ 1 ];  // match[ 1 ] is the prefixed plus sign, if there is one

			matches.push( new Autolinker.match.Phone( {
				tagBuilder  : tagBuilder,
				matchedText : matchedText,
				offset      : match.index,
				number      : cleanNumber,
				plusSign    : plusSign
			} ) );
		}

		return matches;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.matcher.Twitter
 * @extends Autolinker.matcher.Matcher
 *
 * Matcher to find/replace username matches in an input string.
 */
Autolinker.matcher.Twitter = Autolinker.Util.extend( Autolinker.matcher.Matcher, {

	/**
	 * The regular expression to match username handles. Example match:
	 *
	 *     @asdf
	 *
	 * @private
	 * @property {RegExp} matcherRegex
	 */
	matcherRegex : new RegExp( '@[_' + Autolinker.RegexLib.alphaNumericCharsStr + ']{1,20}', 'g' ),

	/**
	 * The regular expression to use to check the character before a username match to
	 * make sure we didn't accidentally match an email address.
	 *
	 * For example, the string "asdf@asdf.com" should not match "@asdf" as a username.
	 *
	 * @private
	 * @property {RegExp} nonWordCharRegex
	 */
	nonWordCharRegex : new RegExp( '[^' + Autolinker.RegexLib.alphaNumericCharsStr + ']' ),


	/**
	 * @inheritdoc
	 */
	parseMatches : function( text ) {
		var matcherRegex = this.matcherRegex,
		    nonWordCharRegex = this.nonWordCharRegex,
		    tagBuilder = this.tagBuilder,
		    matches = [],
		    match;

		while( ( match = matcherRegex.exec( text ) ) !== null ) {
			var offset = match.index,
			    prevChar = text.charAt( offset - 1 );

			// If we found the match at the beginning of the string, or we found the match
			// and there is a whitespace char in front of it (meaning it is not an email
			// address), then it is a username match.
			if( offset === 0 || nonWordCharRegex.test( prevChar ) ) {
				var matchedText = match[ 0 ],
				    twitterHandle = match[ 0 ].slice( 1 );  // strip off the '@' character at the beginning

				matches.push( new Autolinker.match.Twitter( {
					tagBuilder    : tagBuilder,
					matchedText   : matchedText,
					offset        : offset,
					twitterHandle : twitterHandle
				} ) );
			}
		}

		return matches;
	}

} );
/*global Autolinker */
/**
 * @class Autolinker.matcher.Url
 * @extends Autolinker.matcher.Matcher
 *
 * Matcher to find URL matches in an input string.
 *
 * See this class's superclass ({@link Autolinker.matcher.Matcher}) for more details.
 */
Autolinker.matcher.Url = Autolinker.Util.extend( Autolinker.matcher.Matcher, {

	/**
	 * @cfg {Boolean} stripPrefix (required)
	 * @inheritdoc Autolinker#stripPrefix
	 */


	/**
	 * @private
	 * @property {RegExp} matcherRegex
	 *
	 * The regular expression to match URLs with an optional scheme, port
	 * number, path, query string, and hash anchor.
	 *
	 * Example matches:
	 *
	 *     http://google.com
	 *     www.google.com
	 *     google.com/path/to/file?q1=1&q2=2#myAnchor
	 *
	 *
	 * This regular expression will have the following capturing groups:
	 *
	 * 1.  Group that matches a scheme-prefixed URL (i.e. 'http://google.com').
	 *     This is used to match scheme URLs with just a single word, such as
	 *     'http://localhost', where we won't double check that the domain name
	 *     has at least one dot ('.') in it.
	 * 2.  Group that matches a 'www.' prefixed URL. This is only matched if the
	 *     'www.' text was not prefixed by a scheme (i.e.: not prefixed by
	 *     'http://', 'ftp:', etc.)
	 * 3.  A protocol-relative ('//') match for the case of a 'www.' prefixed
	 *     URL. Will be an empty string if it is not a protocol-relative match.
	 *     We need to know the character before the '//' in order to determine
	 *     if it is a valid match or the // was in a string we don't want to
	 *     auto-link.
	 * 4.  Group that matches a known TLD (top level domain), when a scheme
	 *     or 'www.'-prefixed domain is not matched.
	 * 5.  A protocol-relative ('//') match for the case of a known TLD prefixed
	 *     URL. Will be an empty string if it is not a protocol-relative match.
	 *     See #3 for more info.
	 */
	matcherRegex : (function() {
		var schemeRegex = /(?:[A-Za-z][-.+A-Za-z0-9]*:(?![A-Za-z][-.+A-Za-z0-9]*:\/\/)(?!\d+\/?)(?:\/\/)?)/,  // match protocol, allow in format "http://" or "mailto:". However, do not match the first part of something like 'link:http://www.google.com' (i.e. don't match "link:"). Also, make sure we don't interpret 'google.com:8000' as if 'google.com' was a protocol here (i.e. ignore a trailing port number in this regex)
		    wwwRegex = /(?:www\.)/,                  // starting with 'www.'
		    domainNameRegex = Autolinker.RegexLib.domainNameRegex,
		    tldRegex = Autolinker.RegexLib.tldRegex,  // match our known top level domains (TLDs)
		    alphaNumericCharsStr = Autolinker.RegexLib.alphaNumericCharsStr,

		    // Allow optional path, query string, and hash anchor, not ending in the following characters: "?!:,.;"
		    // http://blog.codinghorror.com/the-problem-with-urls/
		    urlSuffixRegex = new RegExp( '[' + alphaNumericCharsStr + '\\-+&@#/%=~_()|\'$*\\[\\]?!:,.;]*[' + alphaNumericCharsStr + '\\-+&@#/%=~_()|\'$*\\[\\]]' );

		return new RegExp( [
			'(?:', // parens to cover match for scheme (optional), and domain
				'(',  // *** Capturing group $1, for a scheme-prefixed url (ex: http://google.com)
					schemeRegex.source,
					domainNameRegex.source,
				')',

				'|',

				'(',  // *** Capturing group $2, for a 'www.' prefixed url (ex: www.google.com)
					'(//)?',  // *** Capturing group $3 for an optional protocol-relative URL. Must be at the beginning of the string or start with a non-word character (handled later)
					wwwRegex.source,
					domainNameRegex.source,
				')',

				'|',

				'(',  // *** Capturing group $4, for known a TLD url (ex: google.com)
					'(//)?',  // *** Capturing group $5 for an optional protocol-relative URL. Must be at the beginning of the string or start with a non-word character (handled later)
					domainNameRegex.source + '\\.',
					tldRegex.source,
				')',
			')',

			'(?:' + urlSuffixRegex.source + ')?'  // match for path, query string, and/or hash anchor - optional
		].join( "" ), 'gi' );
	} )(),


	/**
	 * A regular expression to use to check the character before a protocol-relative
	 * URL match. We don't want to match a protocol-relative URL if it is part
	 * of another word.
	 *
	 * For example, we want to match something like "Go to: //google.com",
	 * but we don't want to match something like "abc//google.com"
	 *
	 * This regular expression is used to test the character before the '//'.
	 *
	 * @private
	 * @type {RegExp} wordCharRegExp
	 */
	wordCharRegExp : /\w/,


	/**
	 * The regular expression to match opening parenthesis in a URL match.
	 *
	 * This is to determine if we have unbalanced parenthesis in the URL, and to
	 * drop the final parenthesis that was matched if so.
	 *
	 * Ex: The text "(check out: wikipedia.com/something_(disambiguation))"
	 * should only autolink the inner "wikipedia.com/something_(disambiguation)"
	 * part, so if we find that we have unbalanced parenthesis, we will drop the
	 * last one for the match.
	 *
	 * @private
	 * @property {RegExp}
	 */
	openParensRe : /\(/g,

	/**
	 * The regular expression to match closing parenthesis in a URL match. See
	 * {@link #openParensRe} for more information.
	 *
	 * @private
	 * @property {RegExp}
	 */
	closeParensRe : /\)/g,


	/**
	 * @constructor
	 * @param {Object} cfg The configuration properties for the Match instance,
	 *   specified in an Object (map).
	 */
	constructor : function( cfg ) {
		Autolinker.matcher.Matcher.prototype.constructor.call( this, cfg );

		this.stripPrefix = cfg.stripPrefix;

		if( this.stripPrefix == null ) throw new Error( '`stripPrefix` cfg required' );
	},


	/**
	 * @inheritdoc
	 */
	parseMatches : function( text ) {
		var matcherRegex = this.matcherRegex,
		    stripPrefix = this.stripPrefix,
		    tagBuilder = this.tagBuilder,
		    matches = [],
		    match;

		while( ( match = matcherRegex.exec( text ) ) !== null ) {
			var matchStr = match[ 0 ],
			    schemeUrlMatch = match[ 1 ],
			    wwwUrlMatch = match[ 2 ],
			    wwwProtocolRelativeMatch = match[ 3 ],
			    //tldUrlMatch = match[ 4 ],  -- not needed at the moment
			    tldProtocolRelativeMatch = match[ 5 ],
			    offset = match.index,
			    protocolRelativeMatch = wwwProtocolRelativeMatch || tldProtocolRelativeMatch,
				prevChar = text.charAt( offset - 1 );

			if( !Autolinker.matcher.UrlMatchValidator.isValid( matchStr, schemeUrlMatch ) ) {
				continue;
			}

			// If the match is preceded by an '@' character, then it is either
			// an email address or a username. Skip these types of matches.
			if( offset > 0 && prevChar === '@' ) {
				continue;
			}

			// If it's a protocol-relative '//' match, but the character before the '//'
			// was a word character (i.e. a letter/number), then we found the '//' in the
			// middle of another word (such as "asdf//asdf.com"). In this case, skip the
			// match.
			if( offset > 0 && protocolRelativeMatch && this.wordCharRegExp.test( prevChar ) ) {
				continue;
			}

			// Handle a closing parenthesis at the end of the match, and exclude
			// it if there is not a matching open parenthesis in the match
			// itself.
			if( this.matchHasUnbalancedClosingParen( matchStr ) ) {
				matchStr = matchStr.substr( 0, matchStr.length - 1 );  // remove the trailing ")"
			} else {
				// Handle an invalid character after the TLD
				var pos = this.matchHasInvalidCharAfterTld( matchStr, schemeUrlMatch );
				if( pos > -1 ) {
					matchStr = matchStr.substr( 0, pos ); // remove the trailing invalid chars
				}
			}

			var urlMatchType = schemeUrlMatch ? 'scheme' : ( wwwUrlMatch ? 'www' : 'tld' ),
			    protocolUrlMatch = !!schemeUrlMatch;

			matches.push( new Autolinker.match.Url( {
				tagBuilder            : tagBuilder,
				matchedText           : matchStr,
				offset                : offset,
				urlMatchType          : urlMatchType,
				url                   : matchStr,
				protocolUrlMatch      : protocolUrlMatch,
				protocolRelativeMatch : !!protocolRelativeMatch,
				stripPrefix           : stripPrefix
			} ) );
		}

		return matches;
	},


	/**
	 * Determines if a match found has an unmatched closing parenthesis. If so,
	 * this parenthesis will be removed from the match itself, and appended
	 * after the generated anchor tag.
	 *
	 * A match may have an extra closing parenthesis at the end of the match
	 * because the regular expression must include parenthesis for URLs such as
	 * "wikipedia.com/something_(disambiguation)", which should be auto-linked.
	 *
	 * However, an extra parenthesis *will* be included when the URL itself is
	 * wrapped in parenthesis, such as in the case of "(wikipedia.com/something_(disambiguation))".
	 * In this case, the last closing parenthesis should *not* be part of the
	 * URL itself, and this method will return `true`.
	 *
	 * @private
	 * @param {String} matchStr The full match string from the {@link #matcherRegex}.
	 * @return {Boolean} `true` if there is an unbalanced closing parenthesis at
	 *   the end of the `matchStr`, `false` otherwise.
	 */
	matchHasUnbalancedClosingParen : function( matchStr ) {
		var lastChar = matchStr.charAt( matchStr.length - 1 );

		if( lastChar === ')' ) {
			var openParensMatch = matchStr.match( this.openParensRe ),
			    closeParensMatch = matchStr.match( this.closeParensRe ),
			    numOpenParens = ( openParensMatch && openParensMatch.length ) || 0,
			    numCloseParens = ( closeParensMatch && closeParensMatch.length ) || 0;

			if( numOpenParens < numCloseParens ) {
				return true;
			}
		}

		return false;
	},


	/**
	 * Determine if there's an invalid character after the TLD in a URL. Valid
	 * characters after TLD are ':/?#'. Exclude scheme matched URLs from this
	 * check.
	 *
	 * @private
	 * @param {String} urlMatch The matched URL, if there was one. Will be an
	 *   empty string if the match is not a URL match.
	 * @param {String} schemeUrlMatch The match URL string for a scheme
	 *   match. Ex: 'http://yahoo.com'. This is used to match something like
	 *   'http://localhost', where we won't double check that the domain name
	 *   has at least one '.' in it.
	 * @return {Number} the position where the invalid character was found. If
	 *   no such character was found, returns -1
	 */
	matchHasInvalidCharAfterTld : function( urlMatch, schemeUrlMatch ) {
		if( !urlMatch ) {
			return -1;
		}

		var offset = 0;
		if ( schemeUrlMatch ) {
			offset = urlMatch.indexOf(':');
			urlMatch = urlMatch.slice(offset);
		}

		var re = /^((.?\/\/)?[A-Za-z0-9\u00C0-\u017F\.\-]*[A-Za-z0-9\u00C0-\u017F\-]\.[A-Za-z]+)/;
		var res = re.exec( urlMatch );
		if ( res === null ) {
			return -1;
		}

		offset += res[1].length;
		urlMatch = urlMatch.slice(res[1].length);
		if (/^[^.A-Za-z:\/?#]/.test(urlMatch)) {
			return offset;
		}

		return -1;
	}

} );
/*global Autolinker */
/*jshint scripturl:true */
/**
 * @private
 * @class Autolinker.matcher.UrlMatchValidator
 * @singleton
 *
 * Used by Autolinker to filter out false URL positives from the
 * {@link Autolinker.matcher.Url UrlMatcher}.
 *
 * Due to the limitations of regular expressions (including the missing feature
 * of look-behinds in JS regular expressions), we cannot always determine the
 * validity of a given match. This class applies a bit of additional logic to
 * filter out any false positives that have been matched by the
 * {@link Autolinker.matcher.Url UrlMatcher}.
 */
Autolinker.matcher.UrlMatchValidator = {

	/**
	 * Regex to test for a full protocol, with the two trailing slashes. Ex: 'http://'
	 *
	 * @private
	 * @property {RegExp} hasFullProtocolRegex
	 */
	hasFullProtocolRegex : /^[A-Za-z][-.+A-Za-z0-9]*:\/\//,

	/**
	 * Regex to find the URI scheme, such as 'mailto:'.
	 *
	 * This is used to filter out 'javascript:' and 'vbscript:' schemes.
	 *
	 * @private
	 * @property {RegExp} uriSchemeRegex
	 */
	uriSchemeRegex : /^[A-Za-z][-.+A-Za-z0-9]*:/,

	/**
	 * Regex to determine if at least one word char exists after the protocol (i.e. after the ':')
	 *
	 * @private
	 * @property {RegExp} hasWordCharAfterProtocolRegex
	 */
	hasWordCharAfterProtocolRegex : /:[^\s]*?[A-Za-z\u00C0-\u017F]/,


	/**
	 * Determines if a given URL match found by the {@link Autolinker.matcher.Url UrlMatcher}
	 * is valid. Will return `false` for:
	 *
	 * 1) URL matches which do not have at least have one period ('.') in the
	 *    domain name (effectively skipping over matches like "abc:def").
	 *    However, URL matches with a protocol will be allowed (ex: 'http://localhost')
	 * 2) URL matches which do not have at least one word character in the
	 *    domain name (effectively skipping over matches like "git:1.0").
	 * 3) A protocol-relative url match (a URL beginning with '//') whose
	 *    previous character is a word character (effectively skipping over
	 *    strings like "abc//google.com")
	 *
	 * Otherwise, returns `true`.
	 *
	 * @param {String} urlMatch The matched URL, if there was one. Will be an
	 *   empty string if the match is not a URL match.
	 * @param {String} protocolUrlMatch The match URL string for a protocol
	 *   match. Ex: 'http://yahoo.com'. This is used to match something like
	 *   'http://localhost', where we won't double check that the domain name
	 *   has at least one '.' in it.
	 * @return {Boolean} `true` if the match given is valid and should be
	 *   processed, or `false` if the match is invalid and/or should just not be
	 *   processed.
	 */
	isValid : function( urlMatch, protocolUrlMatch ) {
		if(
			( protocolUrlMatch && !this.isValidUriScheme( protocolUrlMatch ) ) ||
			this.urlMatchDoesNotHaveProtocolOrDot( urlMatch, protocolUrlMatch ) ||    // At least one period ('.') must exist in the URL match for us to consider it an actual URL, *unless* it was a full protocol match (like 'http://localhost')
			this.urlMatchDoesNotHaveAtLeastOneWordChar( urlMatch, protocolUrlMatch )  // At least one letter character must exist in the domain name after a protocol match. Ex: skip over something like "git:1.0"
		) {
			return false;
		}

		return true;
	},


	/**
	 * Determines if the URI scheme is a valid scheme to be autolinked. Returns
	 * `false` if the scheme is 'javascript:' or 'vbscript:'
	 *
	 * @private
	 * @param {String} uriSchemeMatch The match URL string for a full URI scheme
	 *   match. Ex: 'http://yahoo.com' or 'mailto:a@a.com'.
	 * @return {Boolean} `true` if the scheme is a valid one, `false` otherwise.
	 */
	isValidUriScheme : function( uriSchemeMatch ) {
		var uriScheme = uriSchemeMatch.match( this.uriSchemeRegex )[ 0 ].toLowerCase();

		return ( uriScheme !== 'javascript:' && uriScheme !== 'vbscript:' );
	},


	/**
	 * Determines if a URL match does not have either:
	 *
	 * a) a full protocol (i.e. 'http://'), or
	 * b) at least one dot ('.') in the domain name (for a non-full-protocol
	 *    match).
	 *
	 * Either situation is considered an invalid URL (ex: 'git:d' does not have
	 * either the '://' part, or at least one dot in the domain name. If the
	 * match was 'git:abc.com', we would consider this valid.)
	 *
	 * @private
	 * @param {String} urlMatch The matched URL, if there was one. Will be an
	 *   empty string if the match is not a URL match.
	 * @param {String} protocolUrlMatch The match URL string for a protocol
	 *   match. Ex: 'http://yahoo.com'. This is used to match something like
	 *   'http://localhost', where we won't double check that the domain name
	 *   has at least one '.' in it.
	 * @return {Boolean} `true` if the URL match does not have a full protocol,
	 *   or at least one dot ('.') in a non-full-protocol match.
	 */
	urlMatchDoesNotHaveProtocolOrDot : function( urlMatch, protocolUrlMatch ) {
		return ( !!urlMatch && ( !protocolUrlMatch || !this.hasFullProtocolRegex.test( protocolUrlMatch ) ) && urlMatch.indexOf( '.' ) === -1 );
	},


	/**
	 * Determines if a URL match does not have at least one word character after
	 * the protocol (i.e. in the domain name).
	 *
	 * At least one letter character must exist in the domain name after a
	 * protocol match. Ex: skip over something like "git:1.0"
	 *
	 * @private
	 * @param {String} urlMatch The matched URL, if there was one. Will be an
	 *   empty string if the match is not a URL match.
	 * @param {String} protocolUrlMatch The match URL string for a protocol
	 *   match. Ex: 'http://yahoo.com'. This is used to know whether or not we
	 *   have a protocol in the URL string, in order to check for a word
	 *   character after the protocol separator (':').
	 * @return {Boolean} `true` if the URL match does not have at least one word
	 *   character in it after the protocol, `false` otherwise.
	 */
	urlMatchDoesNotHaveAtLeastOneWordChar : function( urlMatch, protocolUrlMatch ) {
		if( urlMatch && protocolUrlMatch ) {
			return !this.hasWordCharAfterProtocolRegex.test( urlMatch );
		} else {
			return false;
		}
	}

};
/*global Autolinker */
/**
 * A truncation feature where the ellipsis will be placed at the end of the URL.
 *
 * @param {String} anchorText
 * @param {Number} truncateLen The maximum length of the truncated output URL string.
 * @param {String} ellipsisChars The characters to place within the url, e.g. "..".
 * @return {String} The truncated URL.
 */
Autolinker.truncate.TruncateEnd = function(anchorText, truncateLen, ellipsisChars){
	return Autolinker.Util.ellipsis( anchorText, truncateLen, ellipsisChars );
};

/*global Autolinker */
/**
 * Date: 2015-10-05
 * Author: Kasper Søfren <soefritz@gmail.com> (https://github.com/kafoso)
 *
 * A truncation feature, where the ellipsis will be placed in the dead-center of the URL.
 *
 * @param {String} url             A URL.
 * @param {Number} truncateLen     The maximum length of the truncated output URL string.
 * @param {String} ellipsisChars   The characters to place within the url, e.g. "..".
 * @return {String} The truncated URL.
 */
Autolinker.truncate.TruncateMiddle = function(url, truncateLen, ellipsisChars){
  if (url.length <= truncateLen) {
    return url;
  }
  var availableLength = truncateLen - ellipsisChars.length;
  var end = "";
  if (availableLength > 0) {
    end = url.substr((-1)*Math.floor(availableLength/2));
  }
  return (url.substr(0, Math.ceil(availableLength/2)) + ellipsisChars + end).substr(0, truncateLen);
};

/*global Autolinker */
/**
 * Date: 2015-10-05
 * Author: Kasper Søfren <soefritz@gmail.com> (https://github.com/kafoso)
 *
 * A truncation feature, where the ellipsis will be placed at a section within
 * the URL making it still somewhat human readable.
 *
 * @param {String} url						 A URL.
 * @param {Number} truncateLen		 The maximum length of the truncated output URL string.
 * @param {String} ellipsisChars	 The characters to place within the url, e.g. "..".
 * @return {String} The truncated URL.
 */
Autolinker.truncate.TruncateSmart = function(url, truncateLen, ellipsisChars){
	var parse_url = function(url){ // Functionality inspired by PHP function of same name
		var urlObj = {};
		var urlSub = url;
		var match = urlSub.match(/^([a-z]+):\/\//i);
		if (match) {
			urlObj.scheme = match[1];
			urlSub = urlSub.substr(match[0].length);
		}
		match = urlSub.match(/^(.*?)(?=(\?|#|\/|$))/i);
		if (match) {
			urlObj.host = match[1];
			urlSub = urlSub.substr(match[0].length);
		}
		match = urlSub.match(/^\/(.*?)(?=(\?|#|$))/i);
		if (match) {
			urlObj.path = match[1];
			urlSub = urlSub.substr(match[0].length);
		}
		match = urlSub.match(/^\?(.*?)(?=(#|$))/i);
		if (match) {
			urlObj.query = match[1];
			urlSub = urlSub.substr(match[0].length);
		}
		match = urlSub.match(/^#(.*?)$/i);
		if (match) {
			urlObj.fragment = match[1];
			//urlSub = urlSub.substr(match[0].length);  -- not used. Uncomment if adding another block.
		}
		return urlObj;
	};

	var buildUrl = function(urlObj){
		var url = "";
		if (urlObj.scheme && urlObj.host) {
			url += urlObj.scheme + "://";
		}
		if (urlObj.host) {
			url += urlObj.host;
		}
		if (urlObj.path) {
			url += "/" + urlObj.path;
		}
		if (urlObj.query) {
			url += "?" + urlObj.query;
		}
		if (urlObj.fragment) {
			url += "#" + urlObj.fragment;
		}
		return url;
	};

	var buildSegment = function(segment, remainingAvailableLength){
		var remainingAvailableLengthHalf = remainingAvailableLength/ 2,
				startOffset = Math.ceil(remainingAvailableLengthHalf),
				endOffset = (-1)*Math.floor(remainingAvailableLengthHalf),
				end = "";
		if (endOffset < 0) {
			end = segment.substr(endOffset);
		}
		return segment.substr(0, startOffset) + ellipsisChars + end;
	};
	if (url.length <= truncateLen) {
		return url;
	}
	var availableLength = truncateLen - ellipsisChars.length;
	var urlObj = parse_url(url);
	// Clean up the URL
	if (urlObj.query) {
		var matchQuery = urlObj.query.match(/^(.*?)(?=(\?|\#))(.*?)$/i);
		if (matchQuery) {
			// Malformed URL; two or more "?". Removed any content behind the 2nd.
			urlObj.query = urlObj.query.substr(0, matchQuery[1].length);
			url = buildUrl(urlObj);
		}
	}
	if (url.length <= truncateLen) {
		return url;
	}
	if (urlObj.host) {
		urlObj.host = urlObj.host.replace(/^www\./, "");
		url = buildUrl(urlObj);
	}
	if (url.length <= truncateLen) {
		return url;
	}
	// Process and build the URL
	var str = "";
	if (urlObj.host) {
		str += urlObj.host;
	}
	if (str.length >= availableLength) {
		if (urlObj.host.length == truncateLen) {
			return (urlObj.host.substr(0, (truncateLen - ellipsisChars.length)) + ellipsisChars).substr(0, truncateLen);
		}
		return buildSegment(str, availableLength).substr(0, truncateLen);
	}
	var pathAndQuery = "";
	if (urlObj.path) {
		pathAndQuery += "/" + urlObj.path;
	}
	if (urlObj.query) {
		pathAndQuery += "?" + urlObj.query;
	}
	if (pathAndQuery) {
		if ((str+pathAndQuery).length >= availableLength) {
			if ((str+pathAndQuery).length == truncateLen) {
				return (str + pathAndQuery).substr(0, truncateLen);
			}
			var remainingAvailableLength = availableLength - str.length;
			return (str + buildSegment(pathAndQuery, remainingAvailableLength)).substr(0, truncateLen);
		} else {
			str += pathAndQuery;
		}
	}
	if (urlObj.fragment) {
		var fragment = "#"+urlObj.fragment;
		if ((str+fragment).length >= availableLength) {
			if ((str+fragment).length == truncateLen) {
				return (str + fragment).substr(0, truncateLen);
			}
			var remainingAvailableLength2 = availableLength - str.length;
			return (str + buildSegment(fragment, remainingAvailableLength2)).substr(0, truncateLen);
		} else {
			str += fragment;
		}
	}
	if (urlObj.scheme && urlObj.host) {
		var scheme = urlObj.scheme + "://";
		if ((str+scheme).length < availableLength) {
			return (scheme + str).substr(0, truncateLen);
		}
	}
	if (str.length <= truncateLen) {
		return str;
	}
	var end = "";
	if (availableLength > 0) {
		end = str.substr((-1)*Math.floor(availableLength/2));
	}
	return (str.substr(0, Math.ceil(availableLength/2)) + ellipsisChars + end).substr(0, truncateLen);
};

return Autolinker;
}));

window.PureChatRegExp = {
	linkify: /(^|&nbsp;|\s)(www\.)?(?=[a-zA-Z0-9])(([-a-zA-Z0-9@:%_\+//=]){1,256}\.)+([a-zA-Z]{2,15})\b(:[0-9]{2,})?([?/#]([-a-zA-Z0-9,@:%_\+.~#!?&//=\[\]]|[^\x00-\x7F])*)?/gim,
	email: /^[a-zA-Z]([a-zA-Z0-9\._%\+\-])*@([a-zA-Z0-9\.\-])*\.[a-zA-Z]{2,10}$/,
	brTags: /(<br>|<br\/>)/gi,
	tagRemoval: /<.+?>/g
};

window.pcGenerateEmoteRegex = function pcGenerateEmoteRegex(regex) {
	return new RegExp("([\\s.]|&nbsp;|^)(" + regex + ")(?=[\\s.]|&nbsp;|$)", "gim");
}

window.PureChatEmoticons = {
	regex: {
		'happy': pcGenerateEmoteRegex('(:\\)|:-\\)|\\(happy\\))'),
		'sad': pcGenerateEmoteRegex('(:\\(|:-\\(|\\(sad\\))'),
		'grin': pcGenerateEmoteRegex('(:D|:-D|\\(grin\\))'),
		'sealed': pcGenerateEmoteRegex('(:x|:-x|\\(sealed\\))'),
		'wink': pcGenerateEmoteRegex('(;\\)|;-\\)|\\(wink\\))'),
		'yawn': pcGenerateEmoteRegex('(\\(yawn\\))'),
		'smirk': pcGenerateEmoteRegex('(\\(smirk\\))'),
		'starstruck': pcGenerateEmoteRegex('(\\(starstruck\\))'),
		'depressed': pcGenerateEmoteRegex('(:C|:-C|\\(depressed\\))'),
		'sadnerd': pcGenerateEmoteRegex('(8\\(|8-\\(|\\(sadnerd\\))'),
		'zomg': pcGenerateEmoteRegex('(D:|\\(zomg\\))'),
		'speechless': pcGenerateEmoteRegex('(:\\||:-\\||\\(speechless\\))'),
		"crying": pcGenerateEmoteRegex("(:'\\(|:'-\\(|\\(crying\\))"),
		'relieved': pcGenerateEmoteRegex('(\\(relieved\\))'),
		'satisfied': pcGenerateEmoteRegex('(\\(satisfied\\))'),
		'determined': pcGenerateEmoteRegex('(\\(determined\\))'),
		'tongue': pcGenerateEmoteRegex('(:p|:-p|\\(tongue\\))'),
		'unsure': pcGenerateEmoteRegex('(:-\\/|\\(unsure\\))'),
		'sleep': pcGenerateEmoteRegex('(-_-|\\(sleep\\))'),
		'disguise': pcGenerateEmoteRegex('(8{|8-{|\\(disguise\\))'),
		'cool': pcGenerateEmoteRegex('(B\\)|B-\\)|\\(cool\\))'),
		'nerd': pcGenerateEmoteRegex('(8\\)|8-\\)|\\(nerd\\))'),
		'lovestruck': pcGenerateEmoteRegex('(\\(lovestruck\\))'),
		'angry': pcGenerateEmoteRegex('\\(angry\\)'),
		'evil': pcGenerateEmoteRegex('(\\(evil\\))'),
		'sick': pcGenerateEmoteRegex('(:s|:-s|\\(sick\\))'),
		'embarassed': pcGenerateEmoteRegex('(\\/_\\\\|\\(embarassed\\))'),
		'mustache': pcGenerateEmoteRegex('(:{|\\(mustache\\))'),
		'surprised': pcGenerateEmoteRegex('(:o|:-o|\\(surprised\\))'),
		'tease': pcGenerateEmoteRegex('(;p|;-p|\\(tease\\))'),
		'ninja': pcGenerateEmoteRegex('\\(ninja\\)'),
		'zombie': pcGenerateEmoteRegex('\\(zombie\\)')
	},
	imageMappings: {
		'happy': 'emote-happy',
		'sad': 'emote-sad',
		'grin': 'emote-grin',
		'sealed': 'emote-sealed',
		'wink': 'emote-wink',
		'yawn': 'emote-yawn',
		'smirk': 'emote-smirk',
		'starstruck': 'emote-starstruck',
		'depressed': 'emote-depressed',
		'sadnerd': 'emote-sadnerd',
		'zomg': 'emote-zomg',
		'speechless': 'emote-speechless',
		"crying": 'emote-crying',
		'relieved': 'emote-relieved',
		'satisfied': 'emote-satisfied',
		'determined': 'emote-determined',
		'tongue': 'emote-tongue',
		'unsure': 'emote-unsure',
		'sleep': 'emote-sleep',
		'disguise': 'emote-disguised',
		'cool': 'emote-cool',
		'nerd': 'emote-nerd',
		'lovestruck': 'emote-lovestruck',
		'angry': 'emote-angry',
		'evil': 'emote-evil',
		'sick': 'emote-sick',
		'embarassed': 'emote-embarassed',
		'mustache': 'emote-mustache',
		'surprised': 'emote-surprised',
		'tease': 'emote-tease',
		'ninja': 'emote-ninja',
		'zombie': 'emote-zombie'
	},
	parse: function(message) {
		if (message) {
			for (var r in PureChatEmoticons.regex) {
				message = message.replace(PureChatEmoticons.regex[r], '$1<div class="emoticon ' + PureChatEmoticons.imageMappings[r] + '" title="' + r + '"></div>');
			}
		}
		return message;
	}
};



////Override the default jquery object that is pulled from 
////the window
//if (window.$pureChatJquery) {
//	Backbone.$ = window.$pureChatJquery;
//	Marionette.$ = window.$pureChatJquery;
//}

purechatApp = new Marionette.Application();

purechatApp.start();
Backbone.Relational.showWarnings = false;


purechatApp.module("Constants", function(Constants, app, Backbone, Marionette, $, _) {
	Constants.WidgetType = {
		Tab: 1,
		Button: 2,
		Image: 3,
		ImageTab: 4
	};
	Constants.BasicWidgetType = 1;
	Constants.PersonalChatType = 2;
	Constants.WidgetStates =
	{
		Initializing: "PCStateInitializing",
		Inactive: "PCStateInactive",
		Activating: "PCStateActivating",
		Chatting: "PCStateChatting",
		Closed: "PCStateClosed",
		Unavailable: "PCStateUnavailable",
		Unsupported: "PCStateUnsupported",
		EmailForm: 'PCStateEmailForm'
	};
	Constants.Features = {
		VisitorTracking: 1
	};
	Constants.FeatureStatus = {
		Disabled: 0,
		Enabled: 1,
		Off: -1
	};
});
(window.pcDashboard || purechatApp).module("Logging", function(Logging, app, Backbone, Marionette, $, _) {
	app._logAllAjaxRequests = false;
	var Level = function(level, name) {
		this.level = level;
		this.name = name;
	};

	Level.prototype = {
		toString: function() {
			return this.name;
		},
		equals: function(level) {
			try {
				return this.level == level.level;
			} catch (ex) {
				return false;
			}
		},
		isGreaterOrEqual: function(level) {
			try {
				return this.level >= level.level;
			} catch (ex) {
				return false;
			}
		}
	};

	Level.ALL = new Level(Number.MIN_VALUE, "ALL");
	Level.TRACE = new Level(10000, "TRACE");
	Level.DEBUG = new Level(20000, "DEBUG");
	Level.INFO = new Level(30000, "INFO");
	Level.WARN = new Level(40000, "WARN");
	Level.ERROR = new Level(50000, "ERROR");
	Level.FATAL = new Level(60000, "FATAL");
	Level.OFF = new Level(Number.MAX_VALUE, "OFF");

	var LoggingEvent = function(logger, timeStamp, level, messages, exception) {
		this.logger = logger;
		this.timeStamp = timeStamp;
		this.timeStampInMilliseconds = timeStamp.getTime();
		this.timeStampInSeconds = Math.floor(this.timeStampInMilliseconds / 1000);
		this.milliseconds = this.timeStamp.getMilliseconds();
		this.level = level;
		this.messages = messages;
		this.exception = exception;
	};

	window.onerror = function myErrorHandler(errorMsg, url, lineNumber, column, exceptionObj) {
		if (typeof window.pcDashboard !== 'undefined') {
			if (Logging.logger) {
				Logging.logger.log("ERROR",
					errorMsg + " [line:" + lineNumber + "] " + url,
					exceptionObject != null ? exceptionObj.stack : null,
					false,
					CurrentUser ? CurrentUser.get('chatServerUrl') : null,
					CurrentUser ? CurrentUser.get('accountId') : null);
			}
		}
	}

	var LoggingController = Marionette.Controller.extend({
		_logAllAjaxRequests: false,
		getQueryStringParams: function() {
			var parms = {};
			var query = window.location.search.substr(window.location.search.indexOf('?') + 1);
			if (query.length > 0) {
				var splitQuery = query.split('&');
				splitQuery.forEach(function(s) {
					var splitSegment = s.split('=');
					parms[splitSegment[0]] = typeof splitSegment[1] !== 'undefined' ? splitSegment[1] : null;
				});
			}
			return parms;
		},
		initialize: function() {
			var self = this;
			var parms = this.getQueryStringParams();
			app._logAllAjaxRequests = parms.application_debug || false;
			if (app._logAllAjaxRequests) {
				//$.ajaxSetup({
				//    beforeSend: function (xhr, settings) {
				//        if (!settings.ignoreLogging) {
				//            var data = this.data || {};
				//            self.log(Level.INFO,
				//                ('intercepting ajax request: ' + this.url + ' with the following options: data: ' + JSON.stringify(data)),
				//                new Error().stack,
				//                true);
				//        }
				//    },
				//    complete: function (event, responseMsg) {
				//        if (!this.ignoreLogging) {
				//            self.log(Level.INFO,
				//                ('Ajax request completed ' + (responseMsg == 'success' ? 'successfully' : 'with an error of ' + responseMsg) + ' for url: ' + this.url),
				//                new Error().stack,
				//                true);
				//        }
				//    }
				//});
			}
		},
		log: function(level, message, stackTrace, increaseCharacterLimit, chatServerUrl, accountId) {
			if (_.isString(level)) {
				level = Level[level];
			}

			var logLevel = app.LogLevel || Level.ERROR;

			if (logLevel.isGreaterOrEqual(level)) {
				try {
					$.ajax({
						url: (app.pureServerUrl || '') + '/AjaxLogger/Log',
						dataType: 'jsonp',
						data: {
							level: level.toString(),
							message: message,
							stackTrace: encodeURIComponent(stackTrace.substr(0, increaseCharacterLimit ? 150 : 75)),
							chatServerUrl: encodeURIComponent(chatServerUrl),
							accountId: accountId
						},
						ignoreLogging: true,
						timeout: 20000,
						success: function(response) {
						},
						error: function(xhr, textStatus, error) {
						}
					});
				} catch (e) {
					//catch any exceptions from this method so
					//that errors in logging don't affect the rest
					//of the site.
					console.log(e);
				}
			}
		}
	});


	Logging.addInitializer(function() {
		Logging.logger = new LoggingController();
		//Add this to all controllers to make it easier to call;
		Marionette.Controller.prototype.log = _.bind(Logging.logger.log, Logging.logger);
	});

	Logging.addFinalizer(function() {
		Logging.log = null;
	});

});



purechatApp.module("Utils", function (Utils, app, Backbone, Marionette, $, _) {

	$.throttle = function (delay, no_trailing, callback, debounce_mode) {
		// After wrapper has stopped being called, this timeout ensures that
		// `callback` is executed at the proper times in `throttle` and `end`
		// debounce modes.
		var timeout_id,

			// Keep track of the last time `callback` was executed.
			last_exec = 0;

		// `no_trailing` defaults to falsy.
		if (typeof no_trailing !== 'boolean') {
			debounce_mode = callback;
			callback = no_trailing;
			no_trailing = undefined;
		}

		// The `wrapper` function encapsulates all of the throttling / debouncing
		// functionality and when executed will limit the rate at which `callback`
		// is executed.
		function wrapper() {
			var that = this,
				elapsed = +new Date() - last_exec,
				args = arguments;

			// Execute `callback` and update the `last_exec` timestamp.
			function exec() {
				last_exec = +new Date();
				callback.apply(that, args);
			};

			// If `debounce_mode` is true (at_begin) this is used to clear the flag
			// to allow future `callback` executions.
			function clear() {
				timeout_id = undefined;
			};

			if (debounce_mode && !timeout_id) {
				// Since `wrapper` is being called for the first time and
				// `debounce_mode` is true (at_begin), execute `callback`.
				exec();
			}

			// Clear any existing timeout.
			timeout_id && clearTimeout(timeout_id);

			if (debounce_mode === undefined && elapsed > delay) {
				// In throttle mode, if `delay` time has been exceeded, execute
				// `callback`.
				exec();

			} else if (no_trailing !== true) {
				// In trailing throttle mode, since `delay` time has not been
				// exceeded, schedule `callback` to execute `delay` ms after most
				// recent execution.
				//
				// If `debounce_mode` is true (at_begin), schedule `clear` to execute
				// after `delay` ms.
				//
				// If `debounce_mode` is false (at end), schedule `callback` to
				// execute after `delay` ms.
				timeout_id = setTimeout(debounce_mode ? clear : exec, debounce_mode === undefined ? delay - elapsed : delay);
			}
		};

		// Set the guid of `wrapper` function to the same of original callback, so
		// it can be removed in jQuery 1.4+ .unbind or .die by using the original
		// callback as a reference.
		if ($.guid) {
			wrapper.guid = callback.guid = callback.guid || $.guid++;
		}

		// Return the wrapper function.
		return wrapper;
	};
	Utils.convertTimeFromUtc = function (dateTime, utcOffset) {
		//var splitUtcOffset = utcOffset.split(':');
		//var militaryTimeRegex = /([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)/;
		//var match = militaryTimeRegex.exec(dateTime.toString());
		//var timeIndex = dateTime.toString().search(militaryTimeRegex);
		//var dateTimeString = dateTime.toString().substring(0, timeIndex + match[0].length);
		//dateTime = new Date(dateTimeString + ' GMT' + (splitUtcOffset[0] + splitUtcOffset[1]));
		return dateTime;
	};
	Utils.linkify = function (message) {
		if (message) {
			message = message.replace(/&amp;/gm, '&');
			message = message.replace(PureChatRegExp.brTags, ' <br/> ');
			var linkifiedMessage = Autolinker.link(message, { 'stripPrefix': false });
			return linkifiedMessage;
		}
		return null;
	};
	Utils.formatWhitespace = function (message) {
		var m = message.replace(/\n|\r/gm, " <br/> ");
		m = m.replace(/\t/gm, ' &nbsp; &nbsp; ');
		return m.replace(/\s\s/g, ' &nbsp;');
	};
	Utils.parseEmoticons = function (message) {
		return PureChatEmoticons.parse(message);
	};
	Utils.GaEvent = function (widgetSettings, eventEnabled, event) {
		var category = "GAEventCategory";
		var failedGa = false;
		var eventFnc = function () {
			if (window._gaq || window.ga) {
				if (window.ga) {
					try {
						window.ga('create', widgetSettings.get('GoogId'));
						window.ga('send', 'event', widgetSettings.get(category), widgetSettings.get(event));
					} catch (ex) {
						failedGa = true;
						console.log('Unable to push event to Google via _gaq');
					}
				}
				if ((window.ga && failedGa && window._gaq) || (!failedGa && window._gaq)) {
					try {
						window._gaq.push(['_setAccount', widgetSettings.get('GoogId')]);
						window._gaq.push(['_trackEvent', widgetSettings.get(category), widgetSettings.get(event)]);
					} catch (ex) {
						console.log('Unable to push event to Google via _gaq');
					}
				}
			}
		};
		if (widgetSettings.get('UsingGa') && widgetSettings.get(eventEnabled) && widgetSettings.get(event)) {
			if (!window._gaq && !window.ga && !this.isOperator) {
				(function () {
					var ga = document.createElement('script');
					ga.type = 'text/javascript';
					ga.async = true;
					ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
					var loaded = false;
					ga.onreadystatechange = ga.onload = function (e) {
						if (!loaded && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
							window._gaq = window._gaq || [];
							eventFnc();
							loaded = true;
						}
					};
					document.getElementsByTagName('head').item(0).appendChild(ga);
				})();
			} else if (!this.isOperator) {
				eventFnc();
			}
		}
	};


	Utils.Notifier = function () {
		this.isTitleModified = false;
		this.windowNotifyTimeout = null;
		this.timeoutId = null;
		this.active = false;
		this.mobileActive = false;
		this.mobileAnimationInterval = null;
	};

	Utils.Notifier.prototype.notify = function (message, additionalElement, mouseStopElement) {
		var t = this;

		// Don't notify multiple times at once
		if (t.active) return;

		t.active = true;

		var originalTitle = document.title;
		if (additionalElement) originalElementTitle = additionalElement.text();

		var switchTitle = function () {
			if (t.active == false) {
				document.title = originalTitle;
				if (additionalElement) additionalElement.text(originalElementTitle);
				t.isTitleModified = false;
				return;
			}

			if (t.isTitleModified == true) {
				t.isTitleModified = false;

				document.title = originalTitle;
				if (additionalElement) additionalElement.text(originalElementTitle);
			} else {
				t.isTitleModified = true;

				document.title = message;
				if (additionalElement) additionalElement.text(message);
			}

			t.timeoutId = setTimeout(switchTitle, 900);
		};

		t.timeoutId = setTimeout(switchTitle, 900);

		if (mouseStopElement)
			mouseStopElement.on('mousemove.notifier', function () { t.stop(); });
		else
			$(document).on('mousemove.notifier', function () { t.stop(); });
	};
	Utils.Notifier.prototype.stop = function () {
		this.active = false;
		if (mouseStopElement)
			mouseStopElement.off('mousemove.notifier');
		else
			$(document).off('mousemove.notifier');
	};
	Utils.stripDangerousTags = function (text) {
		return text.replace(/<script>.+<\/script>/gim, '');
	};
	Utils.stripOpenCloseTage = function (text) {
		return text.replace(/<.+?>/gim, '');
	};
	Utils.escapeHtml = function (text, replaceQuotes) {
		var tempElem = $('<div/>');
		text = tempElem.text(text || '').html();
		return text.replace(/"/g, '');
	};
	Utils.addInitializer(function (options) {
		if (typeof Date.prototype.toHourMinuteString !== 'function') {
			Date.prototype.toHourMinuteString = function () {
				var hours = this.getHours();
				var minutes = this.getMinutes();
				var seconds = this.getSeconds();
				var amPM = hours >= 12 ? ' PM' : ' AM';
				var computedHours = hours == 0 ? 12 : hours > 12 ? hours - 12 : hours;
				return computedHours + ':' + (minutes < 10 ? ('0' + minutes) : minutes) + ':' + (seconds < 10 ? ('0' + seconds) : seconds) + amPM;
			};
		}
	});
	Utils.addFinalizer(function (options) {
		Date.prototype.toHourMinuteString = null;
	});
});

function setCookie(c_name, value) {
	var c_value = escape(value);
	document.cookie = c_name + "=" + c_value;
}

function getCookie(c_name) {
	var c_value = document.cookie;
	var c_start = c_value.indexOf(" " + c_name + "=");
	if (c_start == -1) {
		c_start = c_value.indexOf(c_name + "=");
	}
	if (c_start == -1) {
		c_value = null;
	} else {
		c_start = c_value.indexOf("=", c_start) + 1;
		var c_end = c_value.indexOf(";", c_start);
		if (c_end == -1) {
			c_end = c_value.length;
		}
		c_value = unescape(c_value.substring(c_start, c_end));
	}
	return c_value;
}

GetReasonFromResponse = function (reason) {
	return reason == 1 ? 'Available'
		: reason == 2 ? 'NoOperators'
		: reason == 3 ? 'ServerDowntime'
		: reason == 4 ? 'AccountActivity'
		: reason == 5 ? 'ChatQuotaExceeded'
		: reason == 6 ? 'WidgetDisabled'
		: reason == 7 ? 'IpIsbanned'
		: '';
};
// Chat Available callback
_PCcb = function (response) {
	// a = chatAvailable int, r = reason int (from enum server-side)
	window._checkChatAvailableDeferred.resolve({
		available: response.a == 1,
		reason: GetReasonFromResponse(response.r)
	});
	window._checkChatAvailableDeferred = null;
};

!function(exports, global) {
    var _ = global._;
    this.templates = this.templates || {}, this.templates.ChatConnecting = function(obj) {
        var __p = "";
        _.escape, Array.prototype.join;
        return __p += '<div class="spinnerContainer" style="height: 200px;"></div>';
    }, this.templates.ClosedMessage = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj), ctaUrl = obj.getResource("button_cta_url"), httpRegex = new RegExp("(https|http)://");
        return ctaUrl = 0 != ctaUrl.search(httpRegex) ? "http://" + ctaUrl : ctaUrl, __p += '<p class="purechat-message-note" data-resourcekey="closed_message">' + __e(o.getResource("closed_message")) + "</p>", 
        obj.AskForRating && (__p += '<div class="purechat-thumbs-container"><p class="purechat-message-note" data-resourcekey="closed_askForRating">' + __e(o.getResource("closed_askForRating")) + '</p><div class="purechat-thumbs purechat-thumbs-up purechat-thumbs-selectable pc-icon-thumbs-up"></div><div class="purechat-thumbs purechat-thumbs-down purechat-thumbs-selectable pc-icon-thumbs-down"></div></div><p class="purechat-rating-thanks purechat-message-note"></p>'), 
        obj.CtaButton && (__p += '<form class="purechat-form purechat-ended-form" action=""><a href="' + (null == (__t = ctaUrl) ? "" : __t) + '" data-resourcekey="button_cta" class="btn purechat-cta-button ' + (null == (__t = obj.isPersonalChat ? "button green" : "") ? "" : __t) + '" target="_blank">' + __e(o.getResource("button_cta")) + "</a></form>"), 
        obj.DownloadTranscript && (__p += '<p class="purechat-download-container purechat-message-note"><a data-resourcekey="closed_downloadTrans" target="_blank" href="' + (null == (__t = obj.get("pureServerUrl")) ? "" : __t) + "/VisitorWidget/Transcript?chatId=" + (null == (__t = (obj.get("dataController") || obj.get("oldDataController")).connectionInfo.get("chatId")) ? "" : __t) + "&authToken=" + (null == (__t = (obj.get("dataController") || obj.get("oldDataController")).connectionInfo.get("authToken")) ? "" : __t) + '">' + __e(o.getResource("closed_downloadTrans")) + "</a></p>"), 
        __p;
    }, this.templates.ClosedMessageOperator = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj), isOperatorRoom = obj.get("room").roomType == PureChat.enums.roomType.operator;
        if (__p += '<script>!function(d, s, id) {var js, fjs = d.getElementsByTagName(s)[0];if (!d.getElementById(id)) {js = d.createElement(s);js.id = id;js.src = "https://platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js, fjs);}}(document, "script", "twitter-wjs");</script><div class="purechat-message-display-container"><div class="purechat-message-display purechat-clearfix"></div></div><div class="purechat-user-status"></div><div class="purechat-send-form-container"><form class="purechat-send-form" action=""><div class="operator-close-actions"><div class="header"><p class="italic">', 
        __p += 0 == obj.closedReasonCode ? "This chat was closed by the visitor." : 1 == obj.closedReasonCode ? "This chat was closed because the visitor left the page or lost internet connectivity." : 2 == obj.closedReasonCode ? "This chat was closed because there was no activity for this conversation in the past hour." : 3 == obj.closedReasonCode ? "This chat was closed by an operator." : __e(o.getResource("closed_opMessage")), 
        __p += '</p><p class="smaller italic">What would you like to do next?</p></div><div class="button-bar">', 
        1 != obj.get("room").roomType) {
            var name = obj.visitorName && "Visitor" != obj.visitorName ? "%20with%20" + obj.visitorName + "!" : "!";
            __p += '<a href="https://twitter.com/intent/tweet?original_referer=' + (null == (__t = escape(pcDashboard.Settings.get("siteRootUrl"))) ? "" : __t) + "&text=Just%20had%20a%20great%20chat" + (null == (__t = name) ? "" : __t) + '&tw_p=tweetbutton&url=%20&via=PureChat" target="_blank"><i class="pcfont pcfont-twitter-no-border"></i><span class="tip">Share</span></a><a href="#" data-command="exportTranscript" data-command-params="' + (null == (__t = obj.getExportParams()) ? "" : __t) + '"><i class="pcfont pcfont-export"></i><span class="tip">Export</span></a><a href="/Chat/Download/' + (null == (__t = obj.roomId) ? "" : __t) + '" data-chatid="' + (null == (__t = obj.roomId) ? "" : __t) + '" target="_blank"><i class="pcfont pcfont-download"></i><span class="tip">Download</span></a><a href="#" data-chatid="' + (null == (__t = obj.roomId) ? "" : __t) + '" data-command="transcript:email" data-command-params="' + (null == (__t = obj.roomId) ? "" : __t) + '"><i class="pcfont pcfont-email"></i><span class="tip">Email</span></a>';
            var banArgs = {
                chatId: obj.roomId,
                visitorIPAddressId: obj.visitorIPAddressId,
                visitorIPAddress: obj.visitorIPAddress,
                performBan: !0
            }, banArgString = escape(JSON.stringify(banArgs));
            isOperatorRoom || obj.visitorIPAddressId > -1 && (__p += '<a href="#" data-chatid="' + (null == (__t = obj.roomId) ? "" : __t) + "\" data-request='ban:ip' data-request-params=\"" + (null == (__t = banArgString) ? "" : __t) + '"><i class="pcfont pcfont-prohibitory"></i><span class="tip">Ban IP</span></a>');
        }
        return __p += '<a href="#" data-command="removeWidget"><i class="pcfont pcfont-close-chat"></i><span class="tip">Close</span></a></div></div><textarea class="purechat-send-form-message" name="purechat-send-form-message" disabled="disabled"/></form></div>';
    }, this.templates.EmailForm = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-enterinfo-container"><p data-resourcekey="noOperators_email_message">' + (null == (__t = purechatApp.Utils.linkify(_.escape(obj.getResource("emailForm_message")))) ? "" : __t) + '</p></div><form class="purechat-form purechat-email-form" action=""><p class="alert alert-error init-error general-error" style="display: none;"></p>', 
        obj.get("AskForFirstName") && (__p += '<p class="alert alert-error init-error please-enterfirstname" style="display: none;">' + __e(o.getResource("error_enterFirstName")) + '</p><input type="text" class="purechat-firstname-input" autocomplete="off" name="purechat-firstname-input" id="purechat-firstname-input" maxlength="40" value="' + __e(obj.InitialVisitorFirstName) + '" placeholder="' + __e(o.getResource("placeholder_firstName")) + '"/>'), 
        obj.get("AskForLastName") && (__p += '<p class="alert alert-error init-error please-enterlastname" style="display: none;">' + __e(o.getResource("error_enterLastName")) + '</p><input type="text" class="purechat-lastname-input" autocomplete="off" name="purechat-lastname-input" id="purechat-lastname-input" maxlength="40" value="' + __e(obj.InitialVisitorLastName) + '" placeholder="' + __e(o.getResource("placeholder_lastName")) + '"/>'), 
        __p += '<p class="alert alert-error init-error please-enteremail" style="display: none;">' + __e(o.getResource("error_enterEmail")) + '</p><input type="email" class="purechat-email-input" name="purechat-email-input" id="purechat-email-input" maxlength="100" value="' + __e(obj.InitialVisitorEmail) + '" placeholder="' + __e(o.getResource("placeholder_email")) + '"/>', 
        obj.get("AskForPhoneNumber") && (__p += '<p class="alert alert-error init-error please-enterphonenumber" style="display: none;">' + __e(o.getResource("error_enterPhoneNumber")) + '</p><input type="text" class="purechat-phonenumber-input" name="purechat-phonenumber-input" id="purechat-phonenumber-input" maxlength="30" value="' + __e(obj.InitialVisitorPhoneNumber) + '" placeholder="' + __e(o.getResource("placeholder_phonenumber")) + '"/>'), 
        obj.get("AskForPhone") && (__p += '<p class="alert alert-error init-error please-enterunavailablephone" style="display: none;">' + __e(o.getResource("error_enterPhoneNumber")) + '</p><input type="text" class="purechat-unavailablephone-input" id="purechat-unavailablephone-input" name="purechat-unavailablephone-input" maxlength="30" value="' + __e(obj.InitialVisitorPhoneNumber) + '" placeholder="' + __e(o.getResource("noOperators_placeholder_phone")) + '"/>'), 
        obj.get("AskForCompany") && (__p += '<p class="alert alert-error init-error please-entercompany" style="display: none;">' + __e(o.getResource("error_enterCompany")) + '</p><input type="text" class="purechat-company-input" name="purechat-company-input" id="purechat-company-input" maxlength="30" value="' + __e(obj.InitialVisitorCompany) + '" placeholder="' + __e(o.getResource("placeholder_company")) + '"/>'), 
        __p += '<p class="alert alert-error init-error please-enterquestion" style="display: none;">' + __e(o.getResource("error_enterQuestion")) + '</p><textarea class="purechat-question-input" name="purechat-question-input" id="purechat-question-input" rows="3" placeholder="' + __e(o.getResource("placeholder_question")) + '">' + __e(obj.InitialVisitorQuestion) + '</textarea><input type="submit" class="btn" id="purechat-name-submit" value="' + __e(o.getResource("button_sendEmail")) + '" style="display: inline;"/><span class="purechat-email-error">An Error Occurred</span></form>';
    }, this.templates.EmailSent = function(obj) {
        var __t, __p = "";
        _.escape, Array.prototype.join;
        return __p += '<div class="purechat-enterinfo-container purechat-email-success"><p>Email Sent!</p><table><tr><td>Name: </td><td>' + (null == (__t = obj.Name) ? "" : __t) + "</td></tr><tr><td>Email: </td><td>" + (null == (__t = obj.Email) ? "" : __t) + "</td></tr><tr><td>Question: </td><td>" + (null == (__t = obj.Question) ? "" : __t) + "</td></tr></table></div>";
    }, this.templates.Empty = function(obj) {
        var __p = "";
        _.escape, Array.prototype.join;
        return __p;
    }, this.templates.MessageList = function(obj) {
        var __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-message-display-container"><div class="showPrevious"><a href="#">See Previous Conversation</a></div><div class="purechat-message-display purechat-clearfix"></div></div><div class="purechat-user-status"></div><div class="purechat-send-form-container"><form class="purechat-send-form" action=""><textarea class="purechat-send-form-message" name="purechat-send-form-message" placeholder="' + __e(o.getResource("chat_pressEnter")) + '"></textarea><div class="disableTextArea" style=""/>', 
        obj.isMobile() && (__p += '<button type="submit" class="button green send-message">Send</button>'), 
        __p += '</form></div><div class="purechat-confirm-close-modal" style="display: none;"><span class="message">Are you sure you want to close the chat?</span><div class="modal-button-bar"><button type="button" class="btn kill-chat">Yes</button><button type="button" class="btn cancel">No</button></div></div><div class="purchat-confirm-close-modal-overlay" style="display: none;"></div>';
    }, this.templates.MessageView = function(obj) {
        var __t, __p = "";
        _.escape, Array.prototype.join;
        if ("note" == obj.type) __p += '<p class="purechat-message-note important" data-username="' + (null == (__t = obj.username) ? "" : __t) + '" data-resourcekey="' + (null == (__t = obj.resourceKey || "") ? "" : __t) + '">' + (null == (__t = obj.message) ? "" : __t) + "</p>"; else if ("separator" == obj.type) __p += '<p class="purechat-message-note important separator" data-username="' + (null == (__t = obj.username) ? "" : __t) + '" data-resourcekey="' + (null == (__t = obj.resourceKey || "") ? "" : __t) + '">' + (null == (__t = obj.message) ? "" : __t) + "<hr/></p>"; else if ("message" == obj.type && obj.message) {
            var message = purechatApp.Utils.parseEmoticons(obj.message);
            message = purechatApp.Utils.linkify(message), __p += '<div data-resourcekey="' + (null == (__t = obj.resourceKey || "") ? "" : __t) + '" class="purechat-message-container ' + (null == (__t = obj.myMessage ? "purechat-message-right" : "purechat-message-left") ? "" : __t) + '"><img class="gravitar operator-gravatar ' + (null == (__t = obj.myMessage ? "right" : "left") ? "" : __t) + '" height="50" width="50" src="' + (null == (__t = obj.avatarUrl) ? "" : __t) + '" alt="Operator avatar"/><div class="timestamp">', 
            obj.time && (__p += '<span class="time">' + (null == (__t = obj.time.replace(/(\d{1,2}:\d{1,2}):\d{1,2} ([AP]M)/gi, "$1 $2")) ? "" : __t) + "</span>"), 
            __p += '</div><div class="purechat-message">', obj.userName && (__p += '<span class="purechat-displayname">' + (null == (__t = obj.userName) ? "" : __t) + '</span><span class="name-message-separator">:</span>'), 
            __p += '<span class="purechat-message-actual"><span class="purechat-new-thought">' + (null == (__t = message) ? "" : __t) + '</span></span><span class="message-time-separator">-</span></div></div>';
        }
        return __p;
    }, this.templates.PersonalChatDetails = function(obj) {
        var __t, __p = "";
        _.escape, Array.prototype.join;
        __p += '<div class="purechat-personal-avatar-and-details-wrapper"><div class="purechat-personal-avatar"><div class="editor-section hide"></div><div class="content-section">';
        var personalAvUrl = obj.pureServerUrl + "/content/images/Avatars/operator-avatar.png";
        return null !== obj.UserWidgetSettings.get("PersonalAvatarImage") && /[a-zA-Z1-9]/g.test(obj.UserWidgetSettings.get("PersonalAvatarImage").FileId) && (personalAvUrl = obj.pureServerUrl + "/files/download/" + obj.UserWidgetSettings.get("PersonalAvatarImage").FileId + "." + obj.UserWidgetSettings.get("PersonalAvatarImage").FileExtension), 
        __p += '<div class="avatar-image" style="background-image: url(\'' + (null == (__t = personalAvUrl) ? "" : __t) + "');\"></div>", 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-personal-avatar">Change Personal Avatar<span class="image-dimensions tooltip"><span class="arrow"></span><span class="body">Image will be resized to 200px x 200px after upload.</span></span></a>'), 
        __p += '</div></div><div class="purechat-additional-details-container"><div class="purechat-person"><div class="purechat-name"><div class="editor-section"></div><div class="content-section">' + (null == (__t = obj.UserWidgetSettings.get("DisplayName")) ? "" : __t) + '<div class="purechat-italic">' + (null == (__t = obj.UserWidgetSettings.get("Company")) ? "" : __t) + "</div>", 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-name"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += '</div></div><div class="purechat-social-buttons"><div class="editor-section"></div><div class="content-section">', 
        obj.UserWidgetSettings.get("TwitterId") ? __p += '<a href="https://twitter.com/' + (null == (__t = obj.UserWidgetSettings.get("TwitterId")) ? "" : __t) + '" target="_blank" class="purechat-twitter" data-tooltiptext="View ' + (null == (__t = obj.UserWidgetSettings.get("DisplayName")) ? "" : __t) + '\'s Twitter profile"><i class="pcfont pcfont-twitter-no-border"></i></a>' : obj.isInEditorMode && (__p += '<a href="https://twitter.com" target="_blank" class="purechat-twitter faded" data-tooltiptext="Add your Twitter username to allow people to tweet you"><i class="pcfont pcfont-twitter-no-border"></i></a>'), 
        obj.UserWidgetSettings.get("FacebookId") ? __p += '<a href="https://' + (null == (__t = obj.UserWidgetSettings.get("FacebookId")) ? "" : __t) + '" target="_blank" class="purechat-facebook" data-tooltiptext="View ' + (null == (__t = obj.UserWidgetSettings.get("DisplayName")) ? "" : __t) + '\'s Facebook page"><i class="pcfont pcfont-facebook-no-border"></i></a>' : obj.isInEditorMode && (__p += '<a href="https://www.facebook.com/" target="_blank" class="purechat-facebook faded" data-tooltiptext="Add your Facebook Id to allow people to post on your wall"><i class="pcfont pcfont-facebook-no-border"></i></a>'), 
        obj.UserWidgetSettings.get("LinkedInId") ? __p += '<a href="https://' + (null == (__t = obj.UserWidgetSettings.get("LinkedInId")) ? "" : __t) + '" target="_blank" class="purechat-linked-in" data-tooltiptext="View ' + (null == (__t = obj.UserWidgetSettings.get("DisplayName")) ? "" : __t) + '\'s LinkedIn profile"><i class="pcfont pcfont-linked-in-no-border"></i></a>' : obj.isInEditorMode && (__p += '<a href="https://www.linkedin.com/" target="_blank" class="purechat-linked-in faded" data-tooltiptext="Add your public LinkedIn url to allow people to view your LinkedIn profile"><i class="pcfont pcfont-linked-in-no-border"></i></a>'), 
        obj.UserWidgetSettings.get("Email") ? __p += '<a href="mailto:' + (null == (__t = obj.UserWidgetSettings.get("Email")) ? "" : __t) + '" target="_blank" class="purechat-send-email" data-tooltiptext="Send email to ' + (null == (__t = obj.UserWidgetSettings.get("Email")) ? "" : __t) + '"><i class="pcfont pcfont-email"></i></a>' : obj.isInEditorMode && (__p += '<a href="#" target="_blank" class="purechat-linked-in faded" data-tooltiptext="Add an email address to give people another method of contacting you"><i class="pcfont pcfont-email"></i></a>'), 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-social-buttons"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += '</div></div></div><div class="purechat-contact-details">', (obj.isInEditorMode || obj.UserWidgetSettings.get("Website")) && (__p += '<div class="purechat-website"><div class="editor-section"></div><div class="content-section"><a href="' + (null == (__t = obj.UserWidgetSettings.get("Website") ? obj.UserWidgetSettings.get("Website").search("http") != -1 ? obj.UserWidgetSettings.get("Website") : "http://" + obj.UserWidgetSettings.get("Website") : "#") ? "" : __t) + '" target="_blank"><i class="pcfont pcfont-website"></i><span class="text">' + (null == (__t = obj.UserWidgetSettings.get("Website") || '<span class="faded">Enter a website</span>') ? "" : __t) + "</span></a>", 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-website"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += "</div></div>"), (obj.isInEditorMode || obj.UserWidgetSettings.get("PhoneNumber")) && (__p += '<div class="purechat-phone personal"><div class="editor-section"></div><div class="content-section"><a title="Personal" href="tel:' + (null == (__t = obj.UserWidgetSettings.get("PhoneNumber")) ? "" : __t) + '" target="_blank"><i class="pcfont pcfont-mobile"></i><span class="text">' + (null == (__t = obj.UserWidgetSettings.get("PhoneNumber") || '<span class="faded">Enter a phone number</span>') ? "" : __t) + "</span></a>", 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-phone"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += "</div></div>"), (obj.isInEditorMode || obj.UserWidgetSettings.get("Location")) && (__p += '<div class="purechat-location"><div class="editor-section"></div><div class="content-section"><!--<div class="purechat-personal-google-map-container" style="width: 100%; height: 200px;"></div>--><a title="Work" href="https://maps.google.com?q=' + (null == (__t = obj.UserWidgetSettings.get("Location")) ? "" : __t) + '&zoom=12" target="_blank"><i class="pcfont pcfont-location"></i><span class="text">' + (null == (__t = obj.UserWidgetSettings.get("Location") || '<span class="faded">Enter a location</span>') ? "" : __t) + "</span></a>", 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-location"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += "</div></div>"), __p += '</div><div class="purechat-bio">', (obj.isInEditorMode || obj.UserWidgetSettings.get("Bio")) && (__p += '<div class="purechat-bio-text"><div class="editor-section"></div><div class="content-section">' + (null == (__t = (obj.UserWidgetSettings.get("Bio") || '<span class="faded">Add additional information</span>').replace(/\n/g, "<br/>")) ? "" : __t), 
        obj.isInEditorMode && (__p += '<a class="purechat-edit-button" data-editorfor=".purechat-bio"><i class="pcfont pcfont-edit"></i></a>'), 
        __p += "</div></div>"), __p += "</div></div></div>", obj.RequestFromMobileDevice && (__p += '<div class="purechat-start-chat-button-container"><button type="button" class="button green start-chat">Start Chat</button></div>'), 
        __p;
    }, this.templates.Spinner = function(obj) {
        var __p = "";
        _.escape, Array.prototype.join;
        return __p += '<div class="purechat-spinner"></div>';
    }, this.templates.StartChatForm = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return obj.EmailForm ? __p += '<div class="purechat-enterinfo-container"><p data-resourcekey="emailForm_message">' + (null == (__t = purechatApp.Utils.linkify(_.escape(obj.getResource("emailForm_message")))) ? "" : __t) + "</p></div>" : (obj.AskForPhoneNumber || obj.AskForFirstName || obj.AskForLastName || obj.AskForCompany || obj.AskForEmail || obj.AskForQuestion) && (__p += '<div class="purechat-enterinfo-container"><p data-resourcekey="label_initial">' + (null == (__t = purechatApp.Utils.linkify(obj.getResource("label_initial"))) ? "" : __t) + "</p></div>"), 
        __p += '<form class="purechat-form ' + (null == (__t = obj.EmailForm ? "purechat-email-form" : "purechat-init-form") ? "" : __t) + '" action=""><p class="alert alert-error init-error init-error-inline general-error" style="display: none;"></p>', 
        obj.AskForFirstName && (__p += '<p class="alert alert-error init-error init-error-inline please-enterfirstname" style="display: none;">' + __e(o.getResource("error_enterFirstName")) + '</p><input type="text" class="purechat-firstname-input" autocomplete="off" name="purechat-firstname-input" id="purechat-firstname-input" maxlength="40" value="' + __e(obj.InitialVisitorFirstName) + '" placeholder="' + __e(o.getResource("placeholder_firstName")) + '" required/>'), 
        obj.AskForLastName && (__p += '<p class="alert alert-error init-error init-error-inline please-enterlastname" style="display: none;">' + __e(o.getResource("error_enterLastName")) + '</p><input type="text" class="purechat-lastname-input" autocomplete="off" name="purechat-lastname-input" id="purechat-lastname-input" maxlength="40" value="' + __e(obj.InitialVisitorLastName) + '" placeholder="' + __e(o.getResource("placeholder_lastName")) + '" required/>'), 
        obj.AskForEmail && (__p += '<p class="alert alert-error init-error init-error-inline please-enteremail" style="display: none;">' + __e(o.getResource("error_enterEmail")) + '</p><input type="email" class="purechat-email-input" name="purechat-email-input" id="purechat-email-input" maxlength="100" value="' + __e(obj.InitialVisitorEmail) + '" placeholder="' + __e(o.getResource("placeholder_email")) + '" required/>'), 
        obj.AskForPhoneNumber && (__p += '<p class="alert alert-error init-error init-error-inline please-enterphonenumber" style="display: none;">' + __e(o.getResource("error_enterPhoneNumber")) + '</p><input type="text" class="purechat-phonenumber-input" name="purechat-phonenumber-input" id="purechat-phonenumber-input" maxlength="30" value="' + __e(obj.InitialVisitorPhoneNumber) + '" placeholder="' + __e(o.getResource("placeholder_phonenumber")) + '" required/>'), 
        obj.EmailForm && obj.UnavailableAskForPhone && (__p += '<p class="alert alert-error init-error init-error-inline please-enterunavailablephone" style="display: none;">' + __e(o.getResource("error_enterPhoneNumber")) + '</p><input type="text" class="purechat-unavailablephone-input" id="purechat-unavailablephone-input" name="purechat-unavailablephone-input" maxlength="30" value="' + __e(obj.InitialVisitorPhoneNumber) + '" placeholder="' + __e(o.getResource("noOperators_placeholder_phone")) + '" required/>'), 
        obj.AskForCompany && (__p += '<p class="alert alert-error init-error init-error-inline please-entercompany" style="display: none;">' + __e(o.getResource("error_enterCompany")) + '</p><input type="text" class="purechat-company-input" name="purechat-company-input" id="purechat-company-input" maxlength="100" value="' + __e(obj.InitialVisitorCompany) + '" placeholder="' + __e(o.getResource("placeholder_company")) + '" required/>'), 
        obj.AskForQuestion && (__p += '<p class="alert alert-error init-error init-error-inline please-enterquestion" style="display: none;">' + __e(o.getResource("error_enterQuestion")) + '</p><textarea class="purechat-question-input" name="purechat-question-input" id="purechat-question-input" rows="3" placeholder="' + __e(o.getResource("placeholder_question")) + '" required>' + __e(obj.InitialVisitorQuestion) + "</textarea>"), 
        __p += obj.EmailForm ? '<input type="submit" class="btn" id="purechat-name-submit" value="' + __e(o.getResource("button_sendEmail")) + '" style="' + (null == (__t = obj.AskForFirstName || obj.AskForLastName || obj.AskForCompany || obj.AskForQuestion || obj.AskForEmail ? "" : "margin-top: 20px !important;") ? "" : __t) + 'display: inline"><span class="purechat-email-error">An Error Occurred</span>' : '<input type="submit" class="btn" id="purechat-name-submit" value="' + __e(o.getResource("button_startChat")) + '" style="' + (null == (__t = obj.AskForFirstName || obj.AskForLastName || obj.AskForCompany || obj.AskForQuestion || obj.AskForEmail ? "" : "margin-top: 20px !important;") ? "" : __t) + '">', 
        __p += "</form>";
    }, this.templates.StartChatFormAutomatically = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-widget-content ' + (null == (__t = obj.isMobile() ? "mobile fake-chat" : "") ? "" : __t) + '" style=""><div class="message-list-view"><div class="purechat-message-display-container"><div class="purechat-message-display purechat-clearfix"><div class="purechat-message-wrapper purechat-clearfix"><div data-resourcekey="" class="purechat-message-container purechat-message-left">', 
        (obj.isPersonalChat() || obj.isMobile()) && (__p += '<img class="gravitar operator-gravatar left" height="50" width="50" src="' + (null == (__t = obj.personalAvatarUrl()) ? "" : __t) + '" alt="Operator avatar"/>'), 
        __p += '<div class="timestamp"><span class="time">&nbsp;</span></div><div class="purechat-message" style="margin-right: 0;"><span class="name-message-separator">:</span><span class="purechat-message-actual"><span class="purechat-new-thought">' + __e(o.getResource("chat_startedMessage")) + '</span></span><span class="message-time-separator" style="display: none;">-</span></div></div></div></div></div><div class="purechat-user-status"></div><div class="purechat-send-form-container"><form class="purechat-send-form purechat-form" action=""><p class="alert alert-error init-error general-error" style="display: none;"></p><textarea class="purechat-send-form-message purechat-question-input" placeholder="' + __e(o.getResource("chat_pressEnter")) + '" name="purechat-question-input" id="purechat-question-input" rows="3">' + (null == (__t = obj.InitialVisitorQuestion) ? "" : __t) + "</textarea>", 
        obj.isMobile() && (__p += '<button type="submit" class="button green send-message">Send</button>'), 
        __p += '</form></div><div class="purechat-confirm-close-modal" style="display: none;"><span class="message">Are you sure you want to close the chat?</span><div class="modal-button-bar"><button type="button" class="btn kill-chat">Yes</button><button type="button" class="btn cancel">No</button></div></div></div></div>';
    }, this.templates.UnsupportedBrowser = function(obj) {
        var __p = "";
        _.escape, Array.prototype.join;
        return __p += '<p class="purechat-message-note purechat-unitalic">Sorry, but it appears that you are using a browser that is incompatible with Pure Chat\'s technology. <i class="emoticon emote-sad"></i></p><p class="purechat-message-note purechat-unitalic">In order to use Pure Chat\'s live chat capabilities, please upgrade your browser to a newer version, or use one of these recommended alternative browsers:<ul><li><a href="https://www.google.com/chrome" target="_blank">Google Chrome</a></li><li><a href="https://www.mozilla.org/firefox/new" target="_blank">Mozilla Firefox</a></li></ul></p>';
    }, this.templates.Widget = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj), mobile = obj.get("RequestFromMobileDevice") && obj.get("AllowWidgetOnMobile") && !obj.isDesktopDimension(), mobileRequest = obj.get("RequestFromMobileDevice"), isPersonalChat = obj.get("isPersonalChat");
        return __p += '<div class="purechat-expanded"><div class="purechat-collapsed-outer"><div class="purechat-widget-inner purechat-clearfix">', 
        obj.get("isPersonalChat") && (__p += '<div class="purechat-personal-details-container ' + (null == (__t = obj.get("isInEditorMode") ? "personal-editor-active" : "") ? "" : __t) + '"></div>'), 
        __p += '<div class="' + (null == (__t = obj.get("isPersonalChat") ? "purechat-personal-widget-content-wrapper" : "purechat-widget-content-wrapper") ? "" : __t) + '"><div class="purechat-widget-header" data-trigger="collapse">', 
        __p += isPersonalChat ? '<div class="purechat-menu btn-toolbar"><button data-trigger="restartChat" class="btn btn-mini btn-restart" title="Start a new chat" style="display: none;"><i class="pc-icon-repeat" title="Start a new chat"></i></button><button data-trigger="closeChat" class="btn btn-mini btn-close" title="Close chat session" style="display: none;"><i class="pc-icon-remove"></i></button></div>' : '<div class="purechat-menu btn-toolbar"><button data-trigger="restartChat" class="btn btn-mini btn-restart" title="Start a new chat" style="display: inline-block;"><i class="pc-icon-repeat" title="Start a new chat"></i></button><button data-trigger="popOutChat" class="btn btn-mini btn-pop-out" title="Pop out" style="display: inline-block;"><i class="pc-icon-share"></i></button><button data-trigger="expand" class="btn btn-mini actions btn-expand" title="Expand Widget" style="display: inline-block;"><i class="pc-icon-plus"></i></button><button data-trigger="collapse" class="btn btn-mini actions btn-collapse" title="Collapse Widget" style="display: inline-block;"><i class="pc-icon-minus"></i></button><button data-trigger="closeChat" class="btn btn-mini btn-close" title="Close chat session" style="display: inline-block;"><i class="pc-icon-remove"></i></button></div>', 
        __p += '<div class="purechat-widget-title">', isPersonalChat && mobile && (__p += '<a class="purechat-show-personal-details" href="#"><i class="fa fa-chevron-left"></i></a>'), 
        __p += '&nbsp;<span class="purechat-widget-room-avatar" style="display: none;"></span><span class="purechat-widget-title-link"></span></div></div><div class="purechat-content-wrapper purechat-clearfix"><div class="purechat-content"></div>', 
        obj.get("RemoveBranding") ? obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>') : isPersonalChat ? (__p += '<div class="purechat-poweredby-container"><div class="purechat-poweredby"><span>' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '">Pure Chat</a></div></div>', 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>')) : mobile ? (__p += '<div style="display: block; width: 100% !important; font-size: 10px !important; margin-bottom: 10px !important; position: absolute !important; bottom: 0 !important; left: 0 !important;"><span style="font-size: 10px !important;">' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '" style="font-size: 10px !important;">Pure Chat</a>', 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>'), 
        __p += "</div>") : (__p += '<div style="display: block; font-size: 10px !important; margin-bottom: 10px !important; padding-right: 10px !important;"><span style="font-size: 10px !important;">' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '" style="font-size: 10px !important; text-decoration: underline !important;">Pure Chat</a>', 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>'), 
        __p += "</div>"), __p += '</div></div></div></div></div><div class="purechat-button-expand purechat-collapsed ' + (null == (__t = obj.get("CollapsedWidgetImageUrl") ? "purechat-collapsed-image" : "purechat-collapsed-default") ? "" : __t) + '"><div class="purechat-collapsed-outer" data-trigger="expand" style="display: ' + (null == (__t = obj.showTab() ? "none" : "block") ? "" : __t) + '"><div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-header">', 
        mobile && (__p += '<button type="button" class="purechat-expand-mobile-button">' + __e(o.getResource("mobile_expandButton")) + "</button>"), 
        __p += '<div class="purechat-menu btn-toolbar">', mobile || mobileRequest || obj.get("isDirectAccess") || !obj.get("ShowMinimizeWidgetButton") || (__p += '<button type="button" data-trigger="superMinimize" class="btn btn-mini actions purechat-super-minimize-link-button" style="display: none;"><i class="pc-icon-caret-down"></i></button>'), 
        __p += '<button data-trigger="expand" class="btn btn-mini actions btn-expand" title="Expand Widget" style="display: inline-block;"><i class="pc-icon-plus"></i></button><button data-trigger="collapse" class="btn btn-mini actions btn-collapse" title="Collapse Widget" style="display: inline-block;"><i class="pc-icon-minus"></i></button></div><div class="purechat-widget-title">', 
        isPersonalChat && mobile && (__p += '<a class="purechat-show-personal-details" href="#"><i class="fa fa-chevron-left"></i></a>'), 
        __p += '&nbsp;<span class="purechat-widget-room-avatar" style="display: none;"></span><span class="purechat-widget-title-link">' + __e(o.getResource("title_initial")) + '</span></div></div></div></div></div><div class="purechat-mobile-overlay hide"></div>';
    }, this.templates.WidgetDirectAccess = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-expanded"><div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-header"><div class="purechat-menu btn-toolbar"><button data-trigger="restartChat" class="btn btn-mini btn-restart" title="Start a new chat"><i class="pc-icon-repeat" title="Start a new chat"></i></button><button data-trigger="closeChat" class="btn btn-mini btn-close" title="Close chat session"><i class="pc-icon-remove"></i></button></div><div class="purechat-widget-title"><span class="purechat-widget-room-avatar" style="display: none;"></span><span class="purechat-widget-title-link"></span></div></div><div class="purechat-content-wrapper purechat-clearfix"><div class="purechat-content"></div>', 
        obj.get("RemoveBranding") || (__p += '<div class="purechat-poweredby-container"><span class="purechat-poweredby">' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '">Pure Chat</a></div>'), 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left ' + (null == (__t = obj.get("RemoveBranding") ? "kill-positioning" : "") ? "" : __t) + '"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>'), 
        __p += "</div></div></div>";
    }, this.templates.WidgetDirectAccessMobile = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-expanded"><div class="purechat-collapsed-outer"><div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-content-wrapper"><div class="purechat-widget-header"><div class="purechat-menu btn-toolbar"><button data-trigger="restartChat" class="btn btn-mini btn-restart" title="Start a new chat"><i class="pc-icon-repeat" title="Start a new chat"></i></button><button data-trigger="closeChat" class="btn btn-mini btn-close" title="Close chat session"><i class="pc-icon-remove"></i></button></div><div class="purechat-widget-title"><span class="purechat-widget-room-avatar" style="display: none;"></span><span class="purechat-widget-title-link"></span></div></div><div class="purechat-content-wrapper"><div class="purechat-content"></div>', 
        obj.get("RemoveBranding") || (__p += '<div class="purechat-poweredby-container"><span class="purechat-poweredby">' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '">PureChat</a></div>'), 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>'), 
        __p += "</div></div></div></div></div>";
    }, this.templates.WidgetOperator = function(obj) {
        var __p = "";
        _.escape, Array.prototype.join;
        return __p += '<div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-header"><div class="menu btn-toolbar"><span data-trigger="cannedResponses" class="purechat-canned-responses btn-group"><a class="dropdown-toggle btn" data-toggle="dropdown" data-ajax="false">&nbsp;<i class="icon-ellipsis-horizontal icon-white"></i>&nbsp;</a><ul class="dropdown-menu bottom-up"></ul></span>', 
        __p += obj.attributes.isInvisible ? '<button data-trigger="requeueChat" class="btn btn-mini requeue-button"><i class="fa fa-reply"></i><span class="text">Leave</span></button><button data-trigger="removeWidget" class="btn btn-mini closewidget-button"><span class="text">Done</span></button>' : '<button data-trigger="exportToOntime" class="btn btn-mini leave-button"><span class="text">Export</span></button><button data-trigger="requeueChat" class="btn btn-mini requeue-button"><i class="fa fa-reply"></i><span class="text">Requeue</span></button><button data-trigger="removeWidget" class="btn btn-mini closewidget-button"><span class="text">Done</span></button><button data-trigger="closeChat" data-trigger-params=\'{"confirmation": "Are you sure you want to close this chat?"}\' class="btn btn-mini requeue close-button"><span class="text">End Chat</span></button>', 
        __p += '</div><div class="purechat-widget-title"><a class="purechat-widget-title-link"></a></div></div><div class="purechat-chat-info"></div><div class="purechat-content"></div><div class="purechat-poweredby-container"></div></div>';
    }, this.templates.WidgetPoppedOut = function(obj) {
        var __t, __p = "", __e = _.escape, o = (Array.prototype.join, obj);
        return __p += '<div class="purechat-window purechat-expanded"><div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-header"><div class="purechat-menu btn-toolbar"><button data-trigger="restartChat" class="btn btn-mini btn-restart" title="Start a new chat"><i class="pc-icon-repeat" title="Start a new chat"></i></button><button data-trigger="closeChat" class="btn btn-mini btn-close" title="Close chat session"><i class="pc-icon-remove"></i></button></div><div class="purechat-widget-title">', 
        __p += obj.get("RequestFromMobileDevice") && obj.get("AllowWidgetOnMobile") ? '<span class="purechat-widget-title-link">PureChat</span>' : '<span class="purechat-widget-title-link">PureChat</span>&nbsp;<span class="purechat-widget-room-avatar" style="display: none;"></span>', 
        __p += '</div></div><div class="purechat-content-wrapper"><div class="purechat-content"></div>', 
        obj.get("RemoveBranding") || (__p += '<div class="purechat-poweredby-container"><span class="purechat-poweredby">' + __e(o.getResource("poweredby")) + ' </span><a target="_blank" href="' + (null == (__t = obj.poweredByUrl()) ? "" : __t) + '">Pure Chat</a></div>'), 
        obj.showPlaySoundCheckbox() && (__p += '<a href="#" class="purechat-toggle-audio-notifications purechat-bottom-left"><i class="fa ' + (null == (__t = obj.playSoundOnNewMessage() ? "pc-icon-unmute" : "pc-icon-mute") ? "" : __t) + '"></i></a>'), 
        __p += '</div></div></div><div class="purechat-widget purechat-collapsed">', __p += obj.get("CollapsedWidgetImageUrl") ? '<img src="' + (null == (__t = obj.get("CollapsedWidgetImageUrl")) ? "" : __t) + '" data-trigger="expand"/>' : '<div class="purechat-widget-inner purechat-clearfix"><div class="purechat-widget-header"><div class="purechat-menu btn-toolbar"><button data-trigger="expand" class="btn btn-mini actions btn-expand" title="Expand Widget"><i class="pc-icon-plus"></i></button><button data-trigger="collapse" class="btn btn-mini actions btn-collapse" title="Collapse Widget"><i class="pc-icon-minus"></i></button></div><div class="purechat-widget-title"><span class="purechat-widget-title-link">PureChat</span></div></div></div>', 
        __p += "</div>";
    }, global["true"] = exports;
}({}, function() {
    return this;
}());

purechatApp.module("Models", function (Models, app, Backbone, Marionette, $, _) {

	function htmlDecode(value) {
		return $('<div/>').html(value).text();
	}

	Models.Chat = Backbone.RelationalModel.extend({
		defaults: function () {
			return {
				participants: new Models.ChatParticipantCollection()
			}
		},
		relations: [
			{
				type: Backbone.HasMany,
				key: 'messages',
				relatedModel: 'Message',
				collectionType: 'MessageCollection',
				reverseRelation: {
					key: 'chat'
				}
			}, {
				type: Backbone.HasMany,
				key: 'operators',
				relatedModel: 'Operator',
				collectionType: 'OperatorCollection',
				reverseRelation: {
					key: 'chat'
				}
			}, {
				type: Backbone.HasMany,
				key: 'participants',
				relatedModel: 'ChatParticipant',
				collectionType: 'ChatParticipantCollection',
				reverseRelation: {
					key: 'chat'
				}
			}
		],
		getFullName: function () {
			var fullName;
			var firstName = this.get('visitorFirstName');
			var lastName = this.get('visitorLastName');

			if (firstName) {
				fullName = firstName
				if (lastName) {
					fullName += " " + lastName;
				}
			} else if (lastName) {
				fullName = lastName
			}

			if (!fullName) {
				fullName = "Visitor";
			}
			return fullName;
		},
		restartChat: function () {
			this.set("visitorQuestion", null);
			this.get('operators').reset();
			this.get('messages').reset();
			this.set('state', app.Constants.WidgetStates.Inactive);
			this.trigger('chat:restart');
		},
		chatUserNames: function () {
			var userNames = "";
			this.get('operators').forEach(function (next) {
				if (userNames != "") {
					userNames = userNames + ", ";
				}

				userNames = userNames + next.get('userDisplayName');
			});
			return userNames;
		},
		isInChat: function () {
			return this.get('userId') && this.get('chatId') && this.get('authToken');
		},
		initialize: function () {
			var self = this;
			this.get('operators').on('add', function (model) {
				// Operator joined the chat!
				self.trigger('operator:join', model);
			}).on('remove', function (model) {
				// Operator left the chat!
				self.trigger('operator:leave', model);
			});
		}
	});


	Models.Message = Backbone.RelationalModel.extend({
		events: {
			"change:messageResource": function () {
				alert('test');
			}
		}
	});

	Models.MessageCollectionMessagesGrouped = Backbone.Collection.extend({
		initialize: function (models, options) {
			var self = this;
			this.proxy = options.collection;


			this.listenTo(this.proxy, "add", function (model, collection, options) {
				model.set('message', app.Utils.formatWhitespace(model.get('message')));
				var data = model.toJSON();
				var last = null;
				collection.every(function (next) {
					if (next.cid == model.cid) {
						if (last != null
							&& last.get('type') == 'message'
							&& next.get('type') == 'message'
							&& last.get('userId') == next.get('userId')) {
							//there was a message before us.  lets see if it 
							//was for the same user and add it to the group.
							var group = self.get(last.get('relatedCid'));
							if (group) {
								var message = group.get('message');
								message = message + " <div class='purechat-line-break'></div> " + (next.get('message'));
								group.set('message', message);
								group.set('time', next.get('time'));

								model.set('relatedCid', last.get('relatedCid'));
							}
						} else {
							var addedModel = self.add(data);
							model.set('relatedCid', addedModel.cid);
							return false;
						}
					}
					last = next;
					return true;
				});

			});


		},
		comparator: function (a, b) {
			var sort = a.get('date').getTime() - b.get('date').getTime();
			if (sort == 0) {
				//sort = a.get('timeAdded') - b.get('timeAdded');
				if (a.cid < b.cid) {
					return -1
				} else {
					return 1
				}
			}
			return sort;
		}
	});

	Models.MessageCollection = Backbone.Collection.extend({
		model: Models.Message,
		add: function (models, options) {
			if (models) {
				var temp = _.isArray(models) ? models : [models];
				temp.forEach(function (next) {
					next.timeAdded = (new Date()).getTime();
				});
			}

			return Backbone.Collection.prototype.add.apply(this, arguments);
		},
		comparator: function (a, b) {
			var sort = a.get('date').getTime() - b.get('date').getTime();
			if (sort == 0) {
				//sort = a.get('timeAdded') - b.get('timeAdded');

				if (a.cid < b.cid) {
					return -1
				} else {
					return 1
				}
			}
			return sort;
		}
	});

	Models.Operator = Backbone.RelationalModel.extend({
		idAttribute: 'userId'
	});

	Models.OperatorCollection = Backbone.Collection.extend({
		model: Models.Operator
	});

	Models.ChatParticipant = Backbone.RelationalModel.extend({
		idAttribute: 'userId'
	});

	Models.ChatParticipantCollection = Backbone.Collection.extend({
		model: Models.ChatParticipant,
		getOperatorTypingText: function (resourceManger) {
			var typingOperators = this.where({ isTyping: true });
			if (!typingOperators || typingOperators.length === 0) {
				return "";
			} else {
				var typingMessage = "";
				_.each(typingOperators, function (next, index) {
					if (index != 0) {
						typingMessage += ", ";
					}
					var displayName = $.trim(next.get('displayName'));
					typingMessage = "<span data-resourcekey='chat_typing'>" + htmlDecode(typingMessage + _.escape(resourceManger.getResource('chat_typing', { displayName: displayName }))) + "..." + "</span>";
				});
				return typingMessage;
			}


		}
	});


	Models.WidgetSettings = Backbone.RelationalModel.extend({
		getResource: function (key, data) {
			var resources = this.get('StringResources');
			if (!resources) {
				return key;
			}

			if (!data) {
				return resources[key];
			} else {
				var format = resources[key] || '';

				//Make sure format is a string, it might be an integer/float and we don't want
				//it to blow up completely.
				format = format + "";

				//Prevent using variable that input fields
				if (!data['displayName'])
					format = format.replace('{displayName}', '');

				if (!data['chatUserNames'])
					format = format.replace('{chatUserNames}', '');

				if (!self.compiledResources)
					self.compiledResources = {};

				if (!self.compiledResources[format]) {
					self.compiledResources[format] = pc_.template(format, null, {
						interpolate: /\{(.+?)\}/g
					});

				}
				return self.compiledResources[format](data);
			}
		},
		isTabTop: function () {
			return this.get('Position') == 3 || this.get('Position') == 4;
		},
		isTabLeft: function () {
			return this.get('Position') == 1 || this.get('Position') == 3;
		},
		_isDesktopDimension: null,
		isDesktopDimension: function () {
			// Cache the resolution so the widget behavior stays the same after loading
			if (!this._isDesktopDimension) {
				var winHeight = $(window).height();
				var winWidth = $(window).width();
				var desktopHeightThreshold = 625,
					desktopWidthThreshold = 625;
				this._isDesktopDimension = winHeight >= desktopHeightThreshold && winWidth >= desktopWidthThreshold;
			}
			return this._isDesktopDimension;
		},
		isMobileRequest: function () {
			return this.get('RequestFromMobileDevice');
		},
		isAllowedOnMobile: function () {
			return this.get('AllowWidgetOnMobile') || this.get('Demo');
		},
		useMobile: function () {
			return this.isMobileRequest() && this.isAllowedOnMobile();
		},
		showTab: function () {
			var mobileOverride = this.useMobile();
			var desktopDimensions = this.isDesktopDimension();
			return this.get('CollapsedStyle') == app.Constants.WidgetType.Tab || this.get('CollapsedStyle') == app.Constants.WidgetType.ImageTab || (mobileOverride && !desktopDimensions && this.get('CollapsedStyle') != app.Constants.WidgetType.Button);
		},
		showImage: function () {
			return this.get('CollapsedStyle') == app.Constants.WidgetType.Image || this.get('CollapsedStyle') == app.Constants.WidgetType.ImageTab;
		},
		collapsedImageCss: function (available) {
			var baseScale = available ? this.get('AvailableImageScale') : this.get('UnavailableImageScale');
			var scale = baseScale / 100.0;
			var scaledWidth = ((available ? this.get('AvailableImageWidth') : this.get('UnavailableImageWidth')) * scale);
			var scaledHeight = ((available ? this.get('AvailableImageHeight') : this.get('UnavailableImageHeight')) * scale);
			var yOffset = 0;
			var baseYOffset = available ? this.get('AvailableImageYOffset') : this.get('UnavailableImageYOffset');
			if (!this.isTabTop()) {
				yOffset = -(scaledHeight + (baseYOffset || 0));
				if (!this.showTab()) {
					yOffset -= 10;
				}
			} else {
				yOffset = this.showTab() ? 60 : 0;
				yOffset = yOffset + (baseYOffset || 0);
			}
			var baseWidth = available ? this.get('AvailableImageWidth') : this.get('UnavailableImageWidth');
			var baseHeight = available ? this.get('AvailableImageHeight') : this.get('UnavailableImageHeight');
			var imageTop = available ? this.get('AvailableImageTop') : this.get('UnavailableImageTop');
			var scaleCss = [
				"position:absolute;",
				"margin-top: " + yOffset + "px;",
				"width: " + (baseWidth * scale) + "px;",
				"max-width: " + (baseWidth * scale) + "px;",
				"top: 0px;",
				"z-index: " + (imageTop ? 2 : 0) + ";"
			];
			var baseXOffset = available ? this.get('AvailableImageXOffset') : this.get('UnavailableImageXOffset');
			if (!this.showTab()) {
				if (this.isTabLeft()) {
					scaleCss.push("left: 50%;");
					scaleCss.push("margin-left: " + (baseXOffset || 0) + "px;");
				} else {
					scaleCss.push("right: 50%;");
					scaleCss.push("margin-right: " + (-(baseXOffset || 0)) + "px;");
				}
			} else {
				scaleCss.push("left: 50%;");
				scaleCss.push("margin-left: " + -((scaledWidth / 2) - (baseXOffset || 0)) + "px;");
			}
			var cssString = scaleCss.join('');
			return cssString;
		},
		poweredByUrl: function () {
			return 'http://www.purechat.com?utm_source=' + encodeURIComponent(location.hostname) + '&utm_medium=widget&utm_campaign=poweredby';
		},
		absoluteCollapsedImageUrl: function (available) {
			return available ? this.absoluteUrl(this.get('AvailableCollapsedWidgetImageUrl')) : this.absoluteUrl(this.get('UnavailableCollapsedWidgetImageUrl'));
		},
		absoluteUrl: function (path) {
			path = (path || '').trim();
			var tildeInFront = path.indexOf("~") == 0;
			// If the only thing in the path is the tilde
			if (path.length == 1 && tildeInFront) {
				return null;
			}
			if (tildeInFront) {
				return this.get('cdnServerUrl') + path.substring(1);
			}
			return path;
		},
		formatDateTime: function (dateString) {
			var d = new Date(dateString);
			var formattedDate = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
			formattedDate += ' ' + (d.getHours() % 12 == 0 ? '12' : d.getHours() % 12) + ':' + (d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes()) + (d.getHours() >= 12 ? 'PM' : 'AM');
			return formattedDate;
		},
		browserIsUnsupported: function () {
			var unsupported = false;
			var browserDetails = this.get('BrowserDetails');
			browserDetails.Version = parseFloat(browserDetails.Version);
			switch (browserDetails.Browser.toLowerCase().replace(/s+/g, '')) {
				case 'internetexplorer':
				case 'ie':
					if (browserDetails.Version <= 9) {
						unsupported = true;
					}
					break;
				case 'safari':
					if (browserDetails.Version < 5) {
						unsupported = true;
					}
					break;
				case 'opera':
					if (browserDetails.Version < 12) {
						unsupported = true;
					}
				default:
					break;
			}
			return unsupported;
		}
	});

	Models.WidgetSettingsCollection = Backbone.Collection.extend({
		model: Models.WidgetSettings
	});

	Models.ChatConnection = Backbone.Model.extend({
		defaults: {
			chatClosed: false
		},
		initialize: function (data, options) {
			var self = this;
			// I couldn't get the stupid storage change events to work so I resorted to this.
			// I am embarrassed!
			if (!options.isOperator && !options.poppedOut) {
				setInterval(function () {
					self.loadFromLocalStorage();
				}, 2000);
			}
			this.listenTo(this, "change:userId, change:authToken, change:chatClosed", function () {
				//self.set("isInChat", this.get('userId') && this.get('authToken') && (_.isUndefined(this.get('chatClosed')) || this.get('chatClosed') == "false" || !this.get('chatClosed')));
				this.trigger('change:isInChat', this, this.isInChat());
			});
		},
		persistedKeys: ['userId', 'authToken', 'roomId', 'chatId', 'visitorName', 'disabled', 'chatActiveInOtherWindow', 'chatClosed', 'expandSource'],
		persistLocalStorage: function () {

			var self = this;
			_.each(self.persistedKeys, function (key) {
				if (self.get(key) != undefined) {
					localStorage[key] = self.get(key);
				}
			});
			return self;
		},
		clearLocalStorage: function () {

			var self = this;
			_.each(self.persistedKeys, function (key) {
				delete localStorage[key];
			});
			this.clear();
			return self;
		},
		loadFromLocalStorage: function () {
			var self = this;
			_.each(self.persistedKeys, function (key) {
				self.set(key, localStorage[key]);
			});
			return self;
		},
		isInChat: function () {
			return this.get('userId') && this.get('authToken') && (_.isUndefined(this.get('chatClosed')) || this.get('chatClosed') == "false" || !this.get('chatClosed'));
		}
	});
});
Backbone.View.prototype.getResource = function(key, data) {
	return marionette.getOption(this, 'rm').getResource(key, pc_.defaults(data || {}, {
		chatUserNames: ""
	}));
};

Marionette.View.prototype.mixinTemplateHelpers = function(target) {
	target = target || {};
	var templateHelpers = this.templateHelpers || {};

	if (pc_.isFunction(templateHelpers)) {
		templateHelpers = templateHelpers.call(this);
	}
	target.getResource = pc_.bind(backbone.View.prototype.getResource, this);

	return pc_.extend(target, templateHelpers);
};

Marionette.Renderer.render = function(template, data) {
	var t = purechatApp.templates || templates;
	if (typeof template === 'string' && t[template]) {
		template = t[template];
	}

	var templateFunc = typeof template === 'function' ? template : Marionette.TemplateCache.get(template);
	var html = templateFunc(data);
	return html.trim();
};


purechatApp.module("Views", function(Views, app, Backbone, Marionette, $, _, Models) {
	var notifier = new app.Utils.Notifier();
	var firstAnimationTimeout = null;

	Views.Spinner = Marionette.ItemView.extend({
		template: 'Spinner',
		className: 'purechat-spinner-wrapper'
	});

	Views.WidgetLayout = Marionette.LayoutView.extend({
		template: null,
		className: 'purechat',
		optionsStepShown: false,
		maxWidth: 700,
		_audioNotificationLocalStorageKey: '_purechatVisitorWidgetPlaySound',
		regions: {
			content: '.purechat-content',
			personalDetails: '.purechat-personal-details-container'
		},
		events: {
			"click [data-trigger]": "executeCommand",
			'mouseenter': 'peekWidget',
			'mouseleave': 'unpeekWidget',
			'click .purechat-show-personal-details': 'showPersonalDetailsOnMobile',
			'click .purechat-toggle-audio-notifications': 'updatePlayAudioLocalStorage'
		},
		childEvents: {
			'roomHostChanged': function(view, model) {
				this.showRoomHostAvatar(model.get('roomHostAvatarUrl'), model.get('expanded'));
			}
		},
		modelEvents: {
			"change:operatorsAvailable": "operatorsAvailableChanged",
			'api:change': 'apiRoomDetailsChanged'
		},
		ui: {
			content: '.purechat-content',
			purechatCollapsed: '.purechat-collapsed',
			collapsedTabWrapper: '.purechat-collapsed .purechat-collapsed-outer',
			titleWrapper: '.purechat-collapsed .purechat-widget-title',
			title: '.purechat-expanded .purechat-widget-title-link',
			collapsedTitle: '.purechat-collapsed .purechat-widget-title-link',
			popoutButton: '[data-trigger="popOutChat"]',
			closeButton: '[data-trigger="closeChat"]',
			removeWidgetButton: '[data-trigger="removeWidget"]',
			restartButton: '[data-trigger="restartChat"]',
			requeueButton: '[data-trigger="requeueChat"]',
			leaveButton: '[data-trigger="leaveChat"]',
			widgetCollapsed: '.purechat-collapsed',
			widgetExpanded: '.purechat-expanded',
			collapseImage: '.collapsed-image',
			personalDetails: '.purechat-personal-details-container',
			expandMobileButton: '.purechat-expand-mobile-button',
			menuBar: '.purechat-collapsed .purechat-menu',
			poweredBy: '.purechat-content-wrapper div:last-child',
			poweredByHosted: '.purechat-poweredby-container',
			roomAvatarUrl: '.purechat-widget-room-avatar',
			purechatTitleImage: '.purechat-title-image',
			superMinimizeButton: '.purechat-super-minimize-link-button'
		},
		templateHelpers: function() {
			var self = this;
			return $.extend({
				isDesktopDimension: function() {
					return self.options.viewController.isDesktopDimension();
				}
			}, this.settings);
		},
		apiRoomDetailsChanged: function(model, propertyName, newValue) {
			this.options.viewController.apiRoomDetailsChanged(model, propertyName, newValue);
		},
		updatePlayAudioLocalStorage: function(e) {
			var sender = $(e.currentTarget);
			var icon = sender.find('i');
			if (icon.hasClass('pc-icon-unmute')) {
				localStorage[this._audioNotificationLocalStorageKey] = false;
				icon.removeClass('pc-icon-unmute').addClass('pc-icon-mute');
			} else {
				localStorage[this._audioNotificationLocalStorageKey] = true;
				icon.addClass('pc-icon-unmute').removeClass('pc-icon-mute');
			}
			return false;
		},
		hideRoomHostAvatar: function() {
			this.ui.roomAvatarUrl.removeAttr('style').hide();
			this.ui.title.removeClass('purechat-has-room-avatar');
			this.ui.purechatTitleImage.show();
			if (this.$el.hasClass('purechat-top') || this.settings.get('poppedOut')) {
				this.$el.removeClass('purechat-adjust-for-avatar');
			}
		},
		showRoomHostAvatar: function(url, isExpanded) {
			if (typeof isExpanded !== 'undefined') {
				if (url && isExpanded) {
					this.ui.roomAvatarUrl
						.css({
							'background-image': 'url(' + url + ')'
						})
						.show();
					this.ui.title.addClass('purechat-has-room-avatar');
					this.ui.purechatTitleImage.hide();
					if (this.$el.hasClass('purechat-top') || this.settings.get('poppedOut')) {
						// Need to add some additional spacing to the top, but only when in the chat...this sucks :/
						this.$el.addClass('purechat-adjust-for-avatar');
					}
				} else {
					this.hideRoomHostAvatar();
				}
			}
		},
		updateRoomHostName: function(name) {
			if (name) {
				this.setTitle(this.getResource('chat_nowChattingWith', { chatUserNames: [name] }), 'chat_nowChattingWith');
			} else {
				this.setTitle(this.getResource('title_initial'), null, 'title_initial');
			}
		},
		showPersonalDetailsOnMobile: function() {
			var self = this;
			this.$el.find('.purechat-personal-details-container').removeClass('purechat-hide');
			// Wait until jquery is done :/
			setTimeout(function() {
				self.$el.find('.purechat-personal-details-container').css({
					left: 0
				});
			}, 10);
			return false;
		},
		resetPoweredBy: function() {
			var isMobile = this.settings.useMobile() && !this.settings.isDesktopDimension();
			if (!this.settings.get('RemoveBranding') &&
				!this.settings.get('isOperator') &&
				!isMobile) {
				this.ui.poweredBy.html(this._originalPoweredBy);
				this.ui.poweredByHosted.html(this._originalPoweredBy);
				if (!this.settings.get('isPersonalChat')) {
					this.ui.poweredBy.css({
						'text-align': 'right'
					});
					this.ui.poweredByHosted.css({
						'text-align': 'right'
					});
				}
			}
		},
		updatePoweredBy: function(content) {
			var isMobile = this.settings.useMobile() && !this.settings.isDesktopDimension();
			if (!this.settings.get('isOperator') &&
				content &&
				!this.settings.get('RemoveBranding')
				&& !isMobile) {
				this.ui.poweredBy.html(content);
				this.ui.poweredByHosted.html(content);
				if (!this.settings.get('isPersonalChat')) {
					this.ui.poweredBy.css({
						'text-align': 'center'
					});
					this.ui.poweredByHosted.css({
						'text-align': 'center'
					});
				}
			}
		},
		showSpinner: function(jqueryElem) {
			if (!jqueryElem) {
				throw new Error('No jquery element was specified when trying to create a Pure Chat spinner');
			}
			jqueryElem = typeof jqueryElem.data === 'function' ? jqueryElem : $(jqueryElem);
			var spinner = new Views.Spinner();
			spinner.render();
			spinner.$el.appendTo(jqueryElem);
			jqueryElem.data('purechatSpinner', spinner);
		},
		hideSpinner: function(jqueryElem) {
			if (!jqueryElem) {
				throw new Error('No jquery element was specified when trying to create a Pure Chat spinner');
			}
			jqueryElem = typeof jqueryElem.data === 'function' ? jqueryElem : $(jqueryElem);
			var spinner = jqueryElem.data('purechatSpinner');
			if (spinner) {
				spinner.destroy();
			}
			jqueryElem.removeData('purechatSpinner');
		},
		bindAppCommands: function() {
			var self = this;
			try {
				app.commands.removeHandler('poweredby:update');
				app.commands.removeHandler('poweredby:reset');
				app.commands.removehandler('spinner:show');
				app.commands.removehandler('spinner:hide');
			} catch (ex) {

			} finally {
				app.commands.setHandler('poweredby:update', function() {
					self.updatePoweredBy.apply(self, arguments);
				});
				app.commands.setHandler('poweredby:reset', function() {
					self.resetPoweredBy.apply(self, arguments);
				});
				app.commands.setHandler('spinner:show', function() {
					self.showSpinner.apply(self, arguments);
				});
				app.commands.setHandler('spinner:hide', function() {
					self.hideSpinner.apply(self, arguments);
				});
			}
		},
		repositionWidget: function() {
			var positionClasses = {
				1: 'purechat-bottom purechat-bottom-left',
				2: 'purechat-bottom purechat-bottom-right',
				3: 'purechat-top purechat-top-left',
				4: 'purechat-top purechat-top-right',
				9999: 'purechat-widget-button'
			};
			for (var i in positionClasses) {
				this.$el.removeClass(positionClasses[i]);
			}
			if (!this.model.get('isPoppedOut') && !this.settings.get('isDirectAccess')) {
				if (this.settings.get('WidgetType') == app.Constants.WidgetType.Button) {
					this.$el.addClass(positionClasses['9999']);
				} else {
					this.$el.addClass(positionClasses[this.settings.get('Position')]);
				}
			}
		},
		chooseWidgetTemplate: function() {
			var isMobile = this.settings.useMobile();
			var isMobilePCP = this.settings.isMobileRequest() && this.settings.get('isPersonalChat');
			if (this.settings.get('isDirectAccess')) {
				if (isMobile) {
					this.template = 'WidgetDirectAccessMobile';
				} else {
					this.template = 'WidgetDirectAccess';
				}
				this.$el.addClass('purechat-widget purechat-hosted-widget');
			} else if (isMobile && this.settings.get('isDemo')) {
				this.template = 'WidgetDirectAccessMobile';
			} else if (this.settings.get('isOperator')) {
				this.template = 'WidgetOperator';
				this.$el.addClass('purechat-operator');
			} else if (this.settings.get('poppedOut')) {
				this.template = 'WidgetPoppedOut';
				this.$el.addClass('purechat-window purechat-popped-out-widget');
			} else {
				this.template = 'Widget';
				this.$el.addClass('purechat-widget hide');
				if (isMobile && !isMobilePCP && !this.settings.isDesktopDimension()) {
					// Need to add a special class that overrides everything for the widget for mobile button thing
					this.$el.removeClass().addClass('purechat-mobile-widget-button');
				}
			}
		},
		showHideMinimizeButton: function() {
			if (this.settings.get('ShowMinimizeWidgetButton')) {
				// Show!
				this.ui.superMinimizeButton.show();
			} else {
				this.ui.superMinimizeButton.hide();
			}
		},
		bindWidgetSettingsChanges: function() {
			this.listenTo(this.settings, 'change', _.bind(this.updateImageTransform, this));
			this.listenTo(this.settings, 'change:ShowMinimizeWidgetButton', _.bind(this.showHideMinimizeButton, this));
			this.listenTo(this.settings, "change:CollapsedStyle", _.bind(this.updateCollapsedStyle, this));
			this.listenTo(this.settings, "change:AvailableCollapsedWidgetImageUrl", _.bind(this.updateImageSource, this));
			this.listenTo(this.settings, "change:UnavailableCollapsedWidgetImageUrl", _.bind(this.updateImageSource, this));
			this.listenTo(this.settings, "change:AvailableImageXOffset", _.bind(this.updateImageTransform, this));
			this.listenTo(this.settings, "change:AvailableImageYOffset", _.bind(this.updateImageTransform, this));
			this.listenTo(this.settings, "change:UnavailableImageXOffset", _.bind(this.updateImageTransform, this));
			this.listenTo(this.settings, "change:UnavailableImageYOffset", _.bind(this.updateImageTransform, this));
		},
		getOperatorsAvailable: function() {
			return typeof this.model.get('operatorsAvailable') !== 'undefined' ? this.model.get('operatorsAvailable') : true;
		},
		updateCollapsedStyle: function() {
			var mobile = this.settings.useMobile();
			// Default to true if the operatorsAvailable flag hasn't been updated yet, as the widget is probably still loading
			var operatorsAvailable = this.getOperatorsAvailable() || this.options.widgetSettings.get('UseAvailableImageForBoth');
			var imageUrl = this.settings.absoluteCollapsedImageUrl(operatorsAvailable);
			if (imageUrl) {
				var imageHtml = ' <img class="collapsed-image" src="' + imageUrl + '" data-trigger="expand" style="' + this.settings.collapsedImageCss(operatorsAvailable) + '" />';
				if (this.ui.collapseImage) {
					this.ui.collapseImage.remove();
					this.ui.collapseImage = null;
				}
				// If an operator is available, show available image
				if ((!mobile || mobile && this.settings.isDesktopDimension()) && this.settings.showImage()) {
					imageHtml = $(imageHtml);
					// Ghetto
					if (operatorsAvailable && this.settings.get('AvailableCollapsedWidgetImageUrl')) {
						// Set the available image
						this.ui.collapseImage = imageHtml;
					} else if (!operatorsAvailable && this.settings.get('UnavailableCollapsedWidgetImageUrl')) {
						// Set the unavailable image
						this.ui.collapseImage = imageHtml;
					}
					if (this.ui.collapseImage) {
						if (!this.settings.isTabTop()) {
							this.ui.collapseImage = $(imageHtml);
							this.ui.purechatCollapsed.prepend(this.ui.collapseImage);
						} else {
							this.ui.collapseImage = $(imageHtml);
							this.ui.purechatCollapsed.append(this.ui.collapseImage);
						}
					}
				}
			}
			if (this.settings.showTab()) {
				this.ui.collapsedTabWrapper.show();
			} else {
				this.ui.collapsedTabWrapper.hide();
			}

			if (this.settings.get('CollapsedStyle') == app.Constants.WidgetType.Button) {
				$('.purechat-button-expand').css('visibility', 'visible');
			}
		},
		initialize: function() {
			var self = this;
			this.model.set('superMinimize', (window.localStorage.superMinimize || 'false').toLowerCase() == 'true');
			Marionette.LayoutView.prototype.initialize.call(this);
			this.settings = Marionette.getOption(this, 'widgetSettings');
			this.chooseWidgetTemplate();
			this.repositionWidget();
			this.bindWidgetSettingsChanges();
			this.bindAppCommands();
			this.settings.showPlaySoundCheckbox = function() {
				return (!self.settings.get('isOperator') || (self.settings.get('isPersonalChat'))) && !self.settings.useMobile();
			};
			this.settings.playSoundOnNewMessage = function() {
				return (localStorage[self._audioNotificationLocalStorageKey] || 'false').toLowerCase() == 'true';
			};
		},
		setTitle: function(title, resourceKey) {
			this.ui.title.text(title).attr('title', title);
			this.ui.title.attr('data-resourcekey', resourceKey);
			this.ui.collapsedTitle.text(title).attr('title', title);
			this.ui.collapsedTitle.attr('data-resourcekey', resourceKey);
			if (this.options.widgetSettings.get('isPersonalChat') && this.options.widgetSettings.get('isInEditorMode')) {
				// Write out the editor buttons!
				this.ui.title.data('isTitleEditor', true);
				this.ui.collapsedTitle.data('isTitleEditor', true);
				window.pcPersonalEditor.execute('editButton:show', [this.ui.title, this.ui.collapsedTitle]);
			} else if (this.model.get('isPoppedOut')) {
				window.document.title = title;
			}
		},
		updateImageSource: function() {
			// Because of the binding order, this will be called before the updateImageTransform is called
			var self = this;
			var operatorsAvailable = this.getOperatorsAvailable() || this.options.widgetSettings.get('UseAvailableImageForBoth');
			if (this.ui.collapseImage) {
				var img = new Image();
				img.src = operatorsAvailable ? this.options.widgetSettings.get('AvailableCollapsedWidgetImageUrl') : this.options.widgetSettings.get('UnavailableCollapsedWidgetImageUrl');
				// Load the image into memory to get its size
				img.onload = function() {
					self.options.widgetSettings.set({
						ImageHeight: img.naturalHeight,
						ImageWidth: img.naturalWidth
					}, {
						silent: true
					});
					self.ui.collapseImage.attr('src', operatorsAvailable ? self.options.widgetSettings.get('AvailableCollapsedWidgetImageUrl') : self.options.widgetSettings.get('UnavailableCollapsedWidgetImageUrl'));
					self.updateImageTransform();
					setTimeout(function() {
						// Cleanup the image
						delete img;
					}, 0);
				};
			}
		},
		updateImageTransform: function() {
			// Cannot exceed 100% scale, or poop will happen
			var operatorsAvailable = this.getOperatorsAvailable() || this.options.widgetSettings.get('UseAvailableImageForBoth');
			this.options.widgetSettings.set('AvailableImageScale', Math.min(100, this.options.widgetSettings.get('AvailableImageScale')), { silent: true });
			this.options.widgetSettings.set('UnavailableImageScale', Math.min(100, this.options.widgetSettings.get('UnavailableImageScale')), { silent: true });
			if (this.ui.collapseImage && this.ui.collapseImage.attr) {
				this.ui.collapseImage.attr('style', this.options.widgetSettings.collapsedImageCss(operatorsAvailable));
			}
		},
		hideAdditionalDetails: function(e) {
			this.$el.find('.purechat-widget-sliding-panel').removeClass('expanded').addClass('collapsed');
			this.$el.find('.additional-details').removeClass('purechat-hide');
			this.$el.find('.purechat-widget-inner').removeClass('expanded');
			this.$el.css({
				width: this.maxWidth - 200
			});
		},
		showAdditionalDetails: function() {
			var context = this;
			var slidingPanel = context.$el.find('.purechat-widget-sliding-panel');
			var spinner = slidingPanel.find('.spinner');
			spinner.removeClass('purechat-hide');
			var headerHeight = context.$el.find('.purechat-widget-inner .purechat-widget-header').outerHeight();
			context.$el.find('.purechat-widget-inner').addClass('expanded');
			//context.$el.css({
			//    width: context.maxWidth
			//});
			slidingPanel.find('.purechat-widget-header').css({
				height: headerHeight,
				lineHeight: headerHeight + 'px'
			});
			slidingPanel.find('.purechat-additional-content').css({
				top: headerHeight
			});
			slidingPanel.removeClass('collapsed').addClass('expanded');
			spinner.addClass('purechat-hide');
		},
		executeCommand: function(e) {
			e.preventDefault();
			// This prevents any parent elements from capturing bubbling events when a child triggered them and the events are supposed to be different
			e.stopPropagation();
			if (!this.settings.get('isInEditorMode')) {
				var $this = $(e.currentTarget);
				var command = $this.data('trigger');
				var commandParams = $this.data('trigger-params');
				if (this.minimizeOnLoadTimeout) {
					this.minimizeOnLoadTimeout = clearTimeout(this.minimizeOnLoadTimeout);
				}
				return this.triggerMethod(command, commandParams, e);
			}
		},
		focusInput: function() {
			if (!this.options.widgetSettings.get('isDemo') && !this.settings.isMobileRequest()) {
				this.$el.find('.purechat-name-input, .purechat-email-input, .purechat-question-input, .purechat-send-form-message').first().focus();
			}
		},
		getResizedImageDimensions: function(originalHeight, originalWidth, ratio) {
			return {
				height: originalHeight * ratio,
				width: originalWidth * ratio
			};
		},
		clearAutoExpandTimeout: function() {
			if (this._autoExpandTimeout) {
				this._autoExpandTimeout = clearTimeout(this._autoExpandTimeout);
			}
		},
		normalizeMilliseconds: function(ms) {
			return ms * 1000;
		},
		setAutoExpandTimeout: function() {
			var self = this;
			this._autoExpandTimeout = setTimeout(function() {
				self.expand();
				self.clearAutoExpandTimeout();
			}, this.normalizeMilliseconds(this.settings.get('ExpandWidgetTimeout')));
		},
		onSuperMinimize: function(args, e, doTimeout) {
			var isPoppedOut = this.model.get('poppedOut') || this.model.get('isPoppedOut');
			if (!isPoppedOut) {
				if (e) {
					e.stopPropagation();
				}
				var self = this;
				var minFnc = function() {
					self.$el.removeClass('purechat-widget-expanded purechat-widget-collapsed');
					self.$el.addClass('purechat-widget-super-collapsed');
					self.$el.find('.btn-toolbar .btn-expand').show();
					self.$el.find('.btn-toolbar .btn-collapse, .purechat-widget-content, .collapsed-image, .purechat-super-minimize-link-button').hide();
					var baseAmount = (-(self.$el.outerHeight() / 4) * 2) - 4;
					if (self.$el.hasClass('purechat-bottom-right') || self.$el.hasClass('purechat-bottom-left')) {
						self.$el.css({
							bottom: baseAmount
						});
					} else {
						self.$el.css({
							top: baseAmount
						});
					}
					self.model.set('superMinimized', true);
					window.localStorage.superMinimize = true;
				};
				if (doTimeout) {
					this.minimizeOnLoadTimeout = setTimeout(minFnc, 1000);
				} else {
					minFnc();
				}
				this.trigger('minimized');
			}
			return false; // NUKE THE EVENT FROM ORBIT
		},
		peekWidget: function() {
			if (!this.settings.isMobileRequest()) {
				this.$el.removeAttr('style');
			}
		},
		unpeekWidget: function() {
			var self = this;
			if (!this.settings.isMobileRequest() && self.$el.hasClass('purechat-widget-super-collapsed')) {
				if (self.$el.hasClass('purechat-bottom-right') || self.$el.hasClass('purechat-bottom-left')) {
					self.$el.css({
						bottom: (-(self.$el.outerHeight() / 4) * 2) - 4
					});
				} else {
					self.$el.css({
						top: (-(self.$el.outerHeight() / 4) * 2) - 4
					});
				}
			}
		},
		operatorsAvailableChanged: function() {
			if (this.settings.get('isWidget')) {
				if (this.model.get('operatorsAvailable')) {
					this.$el.addClass('purechat-button-available');
					this.$el.removeClass('purechat-button-unavailable');
					this.$el.removeAttr("disabled", "disabled");
				} else {
					this.$el.removeClass('purechat-button-available');
					this.$el.addClass('purechat-button-unavailable');

					if (this.options.widgetSettings.get('UnavailableBehavior') === 0) {
						this.$el.addClass('purechat-button-hidden');
						this.$el.attr("disabled", "disabled");
					}
				}
				this.updateCollapsedStyle();
			}
		},
		onExpand: function(e, externalArgs) {
			var isCollapseCommand = externalArgs.collapse;
			var superMinimize = externalArgs.superMinimize;
			var self = this;
			// IF MOBILE, INTERRUPT EVERYTHING AND OPEN IN A NEW TAB
			var isPoppedOrHosted = self.options.widgetSettings.get('poppedOut') || self.options.widgetSettings.get('isDirectAccess');
			var performPopout = !self.settings.get('isDemo') &&
			(!self.settings.get('isDirectAccess') &&
			(self.settings.get('ForcePopout') &&
				!self.model.get('isPoppedOut')) || self.settings.get('usePrototypeFallback'));
			var isMobile = this.settings.useMobile() && !this.settings.isDesktopDimension();
			if ((isMobile || performPopout) &&
				!isPoppedOrHosted &&
				!self.options.widgetSettings.get('widgetWasPoppedOut')) {
				var viewController = self.options.viewController;
				var dataController = self.options.viewController.getDataController();
				viewController.popoutChatOnExpand(dataController, dataController.options, viewController.chatModel, viewController.state, isMobile);
				self.options.widgetSettings.set('widgetWasPoppedOut', true);
			} else {
				self.options.widgetSettings.get('dataController').checkChatAvailable().done(function(result) {
					self.model.set('operatorsAvailable', result.available);
					if (!isCollapseCommand && !superMinimize) {
						self.expand();
					}
				});
			}
		},
		mobileResize: function() {
			var self = this;
			this.collapseMobile();
		},
		expandMobile: function(firstLoad, callback) {
			var self = this;
			var elem = self.$el;
			var contentElem = elem.find('.purechat-widget-content');
			var poweredByElem = elem.find('.purechat-poweredby-container');
			var headerElem = elem.find('.purechat-widget-header');
			$(window).off('resize.RepositionWidget');
			elem.removeClass('slide-out-of-way').css({
				left: 0
			});
			this.ui.expandMobileButton.hide();
			(callback || function() {}).call(self);
		},
		expand: function(firstLoad, inRoomOnLoad, args) {
			var self = this;
			self.$el.removeClass('purechat-widget-super-collapsed');
			var completeFnc = function() {
				var defFnc = function() {

					self.$el.find('.btn-toolbar .btn-expand').hide();
					self.$el.find('.btn-toolbar .btn-collapse').show();

					self.$el.find('.purechat-widget-content').show();
					self.$el.find('.purechat-widget-content').parent().find('div:last').show();
					self.showRoomHostAvatar(self.options.model.get('roomHostAvatarUrl'));
					self.ui.widgetCollapsed.hide();
					self.ui.widgetExpanded.show();
					var textbox = self.$el.find('input[type=text]:first');
					if (!self.settings.isMobileRequest() && !self.options.widgetSettings.get('isDemo')) {
						if (textbox.length > 0) {
							textbox.trigger('focus');
						} else {
							self.$el.find('textarea:first').trigger('focus');
						}
					}
					self.$el.removeClass('purechat-widget-collapsed');
					self.$el.addClass('purechat-widget-expanded');
				};
				if (!inRoomOnLoad &&
					self.model.get('state') != "PCStateChatting" &&
					self.model.get('state') != 'PCStateClosed' &&
					self.settings.get('StartChatImmediately') &&
					!self.settings.get('isInEditorMode')) {
					defFnc();
				} else {
					defFnc();
				}
				self.model.set({
					'expanded': true
				});
				if (args && args.expandSource) {
					localStorage.expandSource = args.expandSource;
				}
				self.trigger('expanded');
				self.triggerResizedEvent();
			};
			window.localStorage.superMinimize = false;
			if (!self.settings.get('isDemo')) {
				localStorage.expanded = true;
			}
			if (self.settings.useMobile() && !self.settings.isDesktopDimension()) {
				self.expandMobile(firstLoad, completeFnc);
				if (firstLoad) {
					completeFnc();
					self.$el.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
				}
			} else {
				completeFnc();
			}
		},
		collapseMobile: function(firstLoad, callback) {
			var self = this;
			if (!self.settings.get('isDirectAccess') && !this.options.widgetSettings.get('isPersonalChat') && !self.model.get('isPoppedOut')) {
				this.ui.titleWrapper.hide();
				this.ui.menuBar.hide();
				if (!firstLoad) {
					this.ui.expandMobileButton.show();
				}
				var elem = self.$el;
				var windowWidth = $(window).width();
				var visibleButton = this.ui.expandMobileButton;
				var outerWidth = visibleButton.outerWidth();
				if (!this.options.widgetSettings.get('killForPreview') &&
					!this.settings.isMobileRequest()
					&& !(this.options.viewController.isAllowedOnMobile() || this.options.widgetSettings.get('isPersonalChat'))) {
					elem.addClass('slide-out-of-way').css({
						left: windowWidth - visibleButton.outerWidth() // I hate using this kind of logic, but it's to account for the different chat images when they haven't been written to the page yet
					});
					visibleButton.removeAttr('style');
				}
				(callback || function() {}).call(self);
			}
		},
		onCollapse: function(firstLoad) {
			var self = this;
			if (!this.settings.get('isPersonalChat')) {
				localStorage.removeItem('expandSource');
				if (!self.settings.get('isDemo')) {
					localStorage.expanded = false;
				}
				self.$el.removeClass('purechat-widget-expanded');
				self.$el.addClass('purechat-widget-collapsed');
				self.$el.find('.btn-toolbar .btn-expand, .collapsed-image, .purechat-super-minimize-link-button').show();
				this.showHideMinimizeButton();
				self.$el.find('.btn-toolbar .btn-collapse, .purechat-widget-content').hide();
				self.$el.find('.purechat-widget-content').parent().find('div:last').hide();
				var inChat = self.model.get('roomId') || self.settings.get('dataController').checkInRoom();
				this.hideRoomHostAvatar();

				//show the collapsed state unless the widget is set to custom button.
				//In that case collapse to show a tab.
				if (!inChat || self.settings.get('Type') != 2) {
					self.ui.widgetCollapsed.show();
					self.ui.widgetExpanded.hide();
				} else {
					self.ui.widgetCollapsed.hide();
					self.ui.widgetExpanded.show();
					if (self.settings.useMobile() && !self.settings.isDesktopDimension()) {
						// Need to hide the "plus" button if on mobile
						self.$el.find('.purechat-expanded .purechat-menu .btn-expand').hide();
						self.ui.widgetExpanded.off('click.ExpandWidgetForMobile').on('click.ExpandWidgetForMobile', function() {
							self.ui.widgetExpanded.off('click.ExpandWidgetForMobile');
							self.expand();
						});
					}
				}
				self.model.set('expanded', false);
				self.trigger('collapsed');
				self.triggerResizedEvent();
				if (self.settings.useMobile() && !self.settings.isDesktopDimension() && !firstLoad) {
					self.collapseMobile(firstLoad, function() {

					});
				} else {
					this.ui.titleWrapper.show();
					this.ui.menuBar.show();
				}
			}
		},
		onHide: function() {
			this.$el.addClass('purechat-button-hidden');
		},
		onShow: function() {
			var self = this;
			if (self.settings.get('UnavailableBehavior') != 0 ||
				self.model.get('isPoppedOut') ||
				self.model.get('operatorsAvailable') ||
				self.model.get('userId')) {
				self.$el.removeClass('purechat-button-hidden');
			}
			if (!self.model.get('superMinimize')) {
				var animation = self.settings.get('PageLoadAnimation') || self.settings.get('DisplayWidgetAnimation')

				if (animation && (!self.model.get('expanded'))) {
					self.$el.addClass('purechat-' + animation + ' purechat-animated');
				}
			}
			self.triggerResizedEvent();
		},
		triggerResizedEvent: function() {
			this.options.viewController.triggerResizedEvent();
		},
		flashNotification: function(message) {
			//if (this.isOperator == false && this.isWidget == true && this.expanded == false && this.poppedOut == false) {
			// If the user is a visitor widget and the widget is not expanded, flash both
			// the page title and the widget title back and forth
			notifier.notify(message, this.ui.title, this.$el);
			//}
		},
		onRender: function() {
			var self = this;
			this.updateCollapsedStyle();
			this.ui.expandMobileButton.hide();
			this.ui.menuBar.hide();
			this.ui.titleWrapper.hide();
			if (!this.settings.get('isWidget')) {
				this.$el.addClass('purechat-window');
				this.ui.content.addClass('purechat-window-content');
			} else {
				this.ui.content.addClass('purechat-widget-content');
				if (this.settings.isMobileRequest()) {
					this.ui.content.css({ 'overflow-y': 'auto' });
				}
			}
			this.operatorsAvailableChanged();
			this.setTitle(this.settings.get('title') || "");
			var inRoomOnLoad = this.settings.get('dataController').checkInRoom() !== null && typeof this.settings.get('dataController').checkInRoom() !== 'undefined';
			if (!this.settings.get('isDemo') &&
				localStorage.expanded == "true" &&
				!this.settings.get('ForcePopout') &&
				!this.settings.get('usePrototypeFallback') &&
				(inRoomOnLoad || !this.settings.get('StartChatImmediately'))) {
				this.expand(true, inRoomOnLoad);
			} else if (this.model.get('superMinimize')) {
				this.onCollapse(true);
				this.onSuperMinimize(null, null, true);
			} else {
				this.onCollapse(true);
			}
			if (this.$el.hasClass('purechat-top')) {
				this.$el.find('.pc-icon-caret-down').removeClass('pc-icon-caret-down').addClass('pc-icon-caret-up');
			}

			if (this.settings.get('isPersonalChat')) {
				if (this.settings.get('UserWidgetSettings').get('BackgroundType') == 1 && this.settings.get('UserWidgetSettings').get('CustomBackgroundImage') && this.settings.get('UserWidgetSettings').get('CustomBackgroundImage').FileId) {
					$('#background-image').css({
						'background-image': 'url("' + this.settings.get('pureServerUrl') + '/files/download/' + this.settings.get('UserWidgetSettings').get('CustomBackgroundImage').FileId + '.' + this.settings.get('UserWidgetSettings').get('CustomBackgroundImage').FileExtension + '")'
					});
				} else if (this.settings.get('UserWidgetSettings').get('BackgroundType') == 2 && this.settings.get('UserWidgetSettings').get('StockBackgroundImage') && this.settings.get('UserWidgetSettings').get('StockBackgroundImage').Url.toLowerCase() != 'none') {
					$('#background-image').css({
						'background-image': 'url("' + this.settings.get('pureServerUrl') + '' + this.settings.get('UserWidgetSettings').get('StockBackgroundImage').Url + '")'
					});
				} else {
					$('#background-image').addClass('purechat-hide');
					$('body').css({
						backgroundColor: '#' + this.settings.get('UserWidgetSettings').get('BackgroundColor')
					});
				}
			}
			this._originalPoweredBy = this.ui.poweredBy.html() || this.ui.poweredByHosted.html();
			this.showHideMinimizeButton();
		},
		onAfterInsertion: function() {
			var self = this;
			var didExpandMobile = false;
			if (!this.model.get('isOperator')) {
				if (this.settings.useMobile() && !this.settings.isDesktopDimension()) {
					if (self.$el.hasClass('purechat-widget-expanded')) {
						self.expandMobile();
						didExpandMobile = true;
					} else {
						self.collapseMobile(true);
					}
				}
			}
		}
	});

	Views.StartChatForm = Marionette.ItemView.extend({
		template: 'StartChatForm',
		className: 'purechat-start-chat-form',
		events: {
			'submit form': 'startChatSubmit',
			"keydown textarea": "keyDown"
		},
		ui: {
			'form': '.purechat-form',
			'userDisplayName': '.purechat-name-input',
			'userDisplayFirstName': '.purechat-firstname-input',
			'userDisplayLastName': '.purechat-lastname-input',
			'userDisplayCompany': '.purechat-company-input',
			'email': '.purechat-email-input',
			'question': '.purechat-question-input',
			'userDisplayNameError': '.please-entername',
			'emailError': '.please-enteremail',
			'questionError': '.please-enterquestion',
			'phoneNumber': '.purechat-phonenumber-input',
			'unavailablePhoneNumber': '.purechat-unavailablephone-input',
			'phoneNumberError': '.please-enterphonenumber',
			'unavailablePhoneError': '.please-enterunavailablephone',
			userDisplayFirstNameError: '.please-enterfirstname',
			userDisplayLastNameError: '.please-enterlastname',
			userDisplayCompanyError: '.please-entercompany'
		},
		keyDown: function(e) {
		},
		startChatSubmit: function(e) {
			e.preventDefault();
			var self = this;
			if (this.submitDelay) {
				return;
			} else {
				this.submitDelay = true;
				setTimeout(function() {
					delete self.submitDelay;
				}, 500);
			}
			var formType = Marionette.getOption(this, 'FormType');
			var isEmailForm = this.model.get('EmailForm');
			var startImmediately = this.options.settings.get('StartChatImmediately');
			var askForFirstName = this.model.get('AskForFirstName') && (isEmailForm || !startImmediately);
			var askForLastName = this.model.get('AskForLastName') && (isEmailForm || !startImmediately);
			var askForCompany = this.model.get('AskForCompany') && (isEmailForm || !startImmediately);
			var askForEmail = this.model.get('AskForEmail') && (isEmailForm || !startImmediately);
			var askForQuestion = this.model.get('AskForQuestion') || startImmediately;
			var askForPhoneNumber = this.model.get('AskForPhoneNumber') && (isEmailForm || !startImmediately);

			var userDisplayName = null;

			var userDisplayFirstName = null;
			if (askForFirstName)
				userDisplayFirstName = $.trim(this.ui.userDisplayFirstName.val());

			var userDisplayLastName = null;
			if (askForLastName)
				userDisplayLastName = $.trim(this.ui.userDisplayLastName.val());

			var userDisplayCompany = null;
			if (askForCompany)
				userDisplayCompany = $.trim(this.ui.userDisplayCompany.val());

			var userEmail = null;
			if (askForEmail || formType === 'email')
				userEmail = this.ui.email.val();

			var initialQuestion = this.ui.question.val() || this.model.get('InitialVisitorQuestion');

			this.ui.form.find('[class*="please"]').hide();
			if (typeof userDisplayFirstName === 'string' && userDisplayFirstName.length == 0) {
				this.ui.userDisplayFirstNameError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userDisplayLastName === 'string' && userDisplayLastName.length == 0) {
				this.ui.userDisplayLastNameError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userEmail === 'string' && userEmail.length == 0) {
				this.ui.emailError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userDisplayCompany === 'string' && userDisplayCompany.length == 0) {
				this.ui.userDisplayCompanyError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			var phoneNumberVal = this.ui.phoneNumber.val() || this.ui.unavailablePhoneNumber.val() || this.model.get('InitialVisitorPhoneNumber');
			if (askForPhoneNumber) {
				if (phoneNumberVal.length == 0) {
					this.ui.phoneNumberError.show();
					self.options.viewController.triggerResizedEvent();
					return false;
				} else {
					this.ui.phoneNumberError.hide();
					self.options.viewController.triggerResizedEvent();
					this.ui.phoneNumber.val(phoneNumberVal);
				}
			} else if (formType == 'email' && this.model.get('UnavailableAskForPhone')) {
				if (phoneNumberVal.length == 0) {
					this.ui.unavailablePhoneError.show();
					self.options.viewController.triggerResizedEvent();
					return false;
				} else {
					this.ui.unavailablePhoneError.hide();
					self.options.viewController.triggerResizedEvent();
					this.ui.unavailablePhoneNumber.val(phoneNumberVal);
				}
			}
			if (askForQuestion && (initialQuestion === null || $.trim(initialQuestion) == '')) {
				this.ui.questionError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}


			userDisplayFirstName = userDisplayFirstName || self.options.viewController.getPublicApi().get('visitor_firstName') || this.model.get('InitialVisitorFirstName');
			userDisplayLastName = userDisplayLastName || self.options.viewController.getPublicApi().get('visitor_lastName') || this.model.get('InitialVisitorLastName');

			userDisplayCompany = userDisplayCompany || self.options.viewController.getPublicApi().get('visitor_company') || this.model.get('InitialVisitorCompany');
			userEmail = userEmail || self.options.viewController.getPublicApi().get('visitor_email') || this.model.get('InitialVisitorEmail');
			initialQuestion = initialQuestion || self.options.viewController.getPublicApi().get('visitor_question');
			phoneNumberVal = phoneNumberVal || self.options.viewController.getPublicApi().get('visitor_phonenumber');

			if (userDisplayFirstName) {

				userDisplayName = userDisplayFirstName;
				if (userDisplayLastName) {
					userDisplayName += userDisplayLastName;
				}
			} else if (userDisplayLastName) {
				userDisplayName = userDisplayLastName;
			} else {
				userDisplayName = "Visitor";
				userDisplayFirstName = "Visitor";
			}

			userDisplayName = userDisplayFirstName + " " + userDisplayLastName;

			this.model.set({
				Name: userDisplayName,
				FirstName: userDisplayFirstName,
				LastName: userDisplayLastName,
				Company: userDisplayCompany,
				Email: userEmail,
				Question: initialQuestion,
				PhoneNumber: phoneNumberVal
			});
			this.model.trigger("formSubmit", {
				visitorName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayName || ''), true),
				visitorFirstName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayFirstName || ''), true),
				visitorLastName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayLastName || ''), true),
				visitorCompany: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayCompany || ''), true),
				visitorEmail: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userEmail || ''), true),
				visitorQuestion: app.Utils.escapeHtml(app.Utils.stripDangerousTags(initialQuestion || ''), false),
				visitorPhoneNumber: app.Utils.escapeHtml(app.Utils.stripDangerousTags(phoneNumberVal || ''), true)
			});
		},
		isMobile: function() {
			return this.options.settings.useMobile() && this.options.settings.isDesktopDimension();
		},
		onClose: function() {
			if (this.options.settings.get('isPersonalChat') && this.options.settings.get('isInEditorMode') && window.pcPersonalEditor) {
				window.pcPersonalEditor.execute('editButton:hide', this.$el.find('[data-resourcekey]'));
			}
		},
		onRender: function() {
			if (this.options.settings.get('isPersonalChat') || this.isMobile()) {
				this.$el.find('#purechat-name-submit').addClass('button');
				if (this.options.settings.get('isInEditorMode') && window.pcPersonalEditor) {
					this.$el.find('input, textarea').prop('disabled', true);
					window.pcPersonalEditor.execute('editButton:show', this.$el.find('[data-resourcekey]'));
				}
			}
		}
	});


	Views.StartChatFormAutomatically = Views.StartChatForm.extend({
		template: 'StartChatFormAutomatically',
		templateHelpers: function() {
			var self = this;
			return {
				isMobile: function() {
					return self.isMobile();
				},
				personalAvatarUrl: function() {
					return typeof personalAvatarUrl !== 'undefined' ? personalAvatarUrl : self.PureServerUrl() + '/content/images/avatars/1avatar-operator-skinny.png';
				},
				isPersonalChat: function() {
					return self.isPersonalChat();
				}
			};
		},
		isPersonalChat: function() {
			return this.options.settings.get('isPersonalChat');
		},
		PureServerUrl: function() {
			return this.options.settings.get('pureServerUrl');
		},
		isMobile: function() {
			return this.options.settings.useMobile() && !this.options.settings.isDesktopDimension();
		},
		keyDown: function(e) {
			if (e.keyCode === 13 && !e.shiftKey) {
				if (e.ctrlKey) {
					this.ui.question.val(this.ui.question.val() + "\n");
					return true;
				} else {
					// start your submit function
					this.startChatSubmit(e);
					return false;
				}
			}
			return true;
		},
		initialize: function() {
			var self = this;
			this._originalOnRender = this.onRender;
			this.onRender = function() {
				self._originalOnRender();
				if (self.isMobile()) {
					self.$el.removeClass('purechat-start-chat-form');
				}
			};
		},
		onRender: function() {
			if (this.isMobile()) {
				this.$el.addClass('mobile');
			}
			if (this.isPersonalChat()) {
				this.$el.addClass('personal');
			}
			if (this.options.settings.get('isPersonalChat') && this.options.settings.get('isInEditorMode')) {
				this.$el.find('textarea.purechat-send-form-message').prop('disabled', true);
			}
		}
	});

	Views.EmailSent = Marionette.ItemView.extend({
		template: 'EmailSent',
		className: ''
	});

	Views.MessageView = Marionette.ItemView.extend({
		template: 'MessageView',
		className: 'purechat-message-wrapper purechat-clearfix',
		ui: {
		
		},
		modelEvents: {
			"change": "render"
		},
		onRender: function() {
			if (window.pcPersonalEditorSettings && window.pcPersonalEditorSettings.get('isPersonalChat') && window.pcPersonalEditorSettings.get('isInEditorMode') && window.pcPersonalEditor) {
				window.pcPersonalEditor.execute('editButton:show', this.$el.find('[data-resourcekey]'));
			}
			this.$el.attr({
				'data-userid': this.model.get('userId')
			});
			var typeClass = this.model.get('type') || '';
			this.$el.addClass(typeClass.toLowerCase() != 'message' ? typeClass : '');
			this.$el.addClass(this.model.get('isClosedChat') ? 'closed' : '');
		}
	});

	Views.EmptyView = Marionette.ItemView.extend({
		template: 'Empty',
		className: 'empty-item',
		events: {
		
		}
	});

	Views.MessageListView = Marionette.CompositeView.extend({
		scrollBottom: 0,
		template: 'MessageList',
		className: 'message-list-view',
		cannedResponseCollection: null,
		ui: {
			'messageListContainer': '.purechat-message-display',
			"textInput": "textarea",
			"disableTextArea": ".disableTextArea",
			"form": "form",
			"displayContainer": ".purechat-message-display-container",
			"userStatus": ".purechat-user-status",
			"showPrevious": ".showPrevious"
		},
		childView: Views.MessageView,
		emptyView: Views.EmptyView,
		childViewContainer: '.purechat-message-display',
		templateHelpers: function() {
			var self = this;
			var settings = this.options.settings;
			var options = {
				isPersonalChat: function() {
					return settings.get('isPersonalChat') || false;
				},
				isMobile: function() {
					return self.options.settings.useMobile() && !self.options.settings.isDesktopDimension();
				}
			};
			return options;
		},
		collectionEvents: {
			"change": "listChanged",
			"add": "listChanged",
		},
		listChanged: function(model, collection, options) {
			var self = this;

			//Show the message area once we have received our first one;
			if (!this.showMessages)
				this.showMessages = setTimeout(function() { self.ui.messageListContainer.show(); }, 100);


			//Adjust the bottom scroll if we get a message and we are at the top since the scroll position won't update.
			if (!model.get('isClosedChat') && self.scrollBottom != 0 && self.ui.displayContainer.scrollTop() == 0) {
				self.scrollBottom = self.ui.displayContainer[0].scrollHeight - self.ui.displayContainer.height();
			}

			//If this is you message and not from a closed chat, stick to the bottom.;
			if (!model.get('isClosedChat') && this.model.get('userId') == model.get('userId')) {
				self.scrollBottom = 0;
			}

			//Give us some margin for error 
			if (self.scrollBottom <= 20) {
				self.scrollBottom = 0
			}
			if (self.scrollBottom == 0 || model.get('isClosedChat')) {
				if (self.scrollTimeout) {
					clearTimeout(self.scrollTimeout);
					self.scrollTimeout = null;
				}
				self.scrollTimeout = setTimeout(function() {
					self.scrollTimeout = null;
					self.updateScroll();
				}, 0);
			}
		},
		updateScroll: function() {
			var self = this;
			self.ui.displayContainer.scrollTop(self.ui.displayContainer[0].scrollHeight - self.ui.displayContainer.height() - self.scrollBottom);
		},
		modelEvents: {
			'change': function(model) {
				this.triggerMethod('roomHostChanged', model);
			},
			'change:HasMoreTransactions': 'updatePreviousVisibility'
		},
		events: {
			"keydown textarea": "keyDown",
			"keyup textarea": "keyUp",
			"submit form": "postMessage",
			'refreshAutoCompleteSource textarea': function() {
				var self = this;
				self.cannedResponseCollection = [];
				pcDashboard.CannedResponses.ResponseCollection.forEach(function(r) {
					self.cannedResponseCollection.push({
						label: r.get('Content'),
						value: $('<div/>').html(r.get('Content')).text()
					});
				});
				self.ui.textInput.trigger('disableAutoComplete').trigger('enableAutoComplete');
			},
			'disableAutoComplete textarea': function() {
				this.ui.textInput.autocomplete('destroy');
			},
			'enableAutoComplete textarea': function() {
				var self = this;
				this.ui.textInput.autocomplete({
					source: function(request, response) {
						var term = (CurrentUser.get('cannedResponseSettings').get('MatchStartOfCannedResponse') ? '^' : '') + $.ui.autocomplete.escapeRegex(request.term);
						var matcher = new RegExp(term, 'im');
						response($.grep(self.cannedResponseCollection, function(item) {
							return matcher.test(item.label || item.value);
						}));
					},
					delay: 100,
					position: { my: "bottom", at: "top" },
					open: function() {
						var autoWidget = $(this).autocomplete('widget');
						$("<div />").addClass("arrow pure-chat-auto-complete-arrow").appendTo('body').position({
							my: 'center',
							at: 'left+32 bottom+5',
							of: autoWidget
						}).css({
							zIndex: parseInt(autoWidget.css('z-index')) + 1
						});
					},
					close: function() {
						$('.pure-chat-auto-complete-arrow').remove();
					}
				});
				this.ui.textInput.autocomplete('widget').addClass('canned-responses-autocomplete');
			},
			'focus textarea': 'expandForm',
			'click textarea': 'expandForm',
			'blur textarea': 'collapseForm',
			'click .showPrevious': 'showPrevious'
		},
		showPrevious: function() {
			this.triggerMethod("showPrevious");
		},
		getLastMessageWithId: function(currentMessageId) {
			var last = null;
			this.collection.forEach(function(model) {
				if (model.get('userId') && model.get('messageId') != currentMessageId) {
					last = model;
				}
			});
			return last;
		},
		onDestroy: function() {
			$(window).off('resize.ScrollToTopMobile');
			this.$el.find('.purechat-message-display-container').off('scroll');
		},
		updatePreviousVisibility: function() {
			if (this.model.get('HasMoreTransactions')) {
				this.ui.showPrevious.show();
			} else {
				this.ui.showPrevious.hide();
			}
		},
		onRender: function() {
			window.test = this;
			var self = this;
			self.ui.messageListContainer.hide();

			this.ui.displayContainer.on('scroll.displayContainer', function() {
				self.scrollBottom = (self.ui.displayContainer[0].scrollHeight - self.ui.displayContainer.height()) - self.ui.displayContainer.scrollTop();
				self.model.set('scrollBottom', self.scrollBottom);
			});

			if (this.options.settings.get('isInvisible')) {
				this.ui.textInput.attr('disabled', 'disabled');
				this.ui.disableTextArea.show();
			}
			if (this.options.settings.get('isOperator')) {
				this.cannedResponseCollection = pcDashboard.CannedResponses.ResponseCollection;

				if (this.cannedResponseCollection.length == 0) {
					this.cannedResponseCollection = [];
					var cannedResponses = this.options.settings.get('cannedResponses');
					for (i in cannedResponses) {
						if (cannedResponses[i].content !== '===separator===') {
							var next = {
								label: cannedResponses[i].content,
								value: $('<div/>').html(cannedResponses[i].content).text()
							};
							this.cannedResponseCollection.push(next);
						}
					}
				}
				var self = this;
				var ac = window.$(this.ui.textInput).autocomplete({
					source: function(request, response) {
						var term = (CurrentUser.get('cannedResponseSettings').get('MatchStartOfCannedResponse') ? '^' : '') + $.ui.autocomplete.escapeRegex(request.term);
						var matcher = new RegExp(term, 'im');
						var matches = [];
						if (self.cannedResponseCollection.models && self.cannedResponseCollection.models.length) {
							var temp = [];
							self.cannedResponseCollection.models.forEach(function(c) {
								temp.push({
									label: c.get('Content'),
									value: $('<div/>').html(c.get('Content')).text()
								});
							});
							matches = $.grep(temp, function(item) {
								return matcher.test(item.label || item.value);
							});
						} else {
							matches = $.grep(self.cannedResponseCollection, function(item) {
								return matcher.test(item.label || item.value);
							});
						}
						response(matches);
					},
					delay: 100,
					position: { my: "bottom", at: "top" },
					open: function() {
						var autoWidget = $(this).autocomplete('widget');
						$("<div />").addClass("arrow pure-chat-auto-complete-arrow").appendTo('body').position({
							my: 'center',
							at: 'left+32 bottom+5',
							of: autoWidget
						}).css({
							zIndex: parseInt(autoWidget.css('z-index')) + 1
						});
					},
					close: function() {
						$('.pure-chat-auto-complete-arrow').remove();
					}
				});
				ac.autocomplete('widget').addClass('canned-responses-autocomplete');
			}
			if (this.options.settings.get('isPersonalChat')) {
				// Show closed chat button, as we're in a chat on the personal chat page at this point in the flow of data
				this.$el.find('.btn-close').css('display', 'inline-block');
				if (this.options.settings.get('isInEditorMode') && window.pcPersonalEditor) {
					this.$el.find('textarea').prop('disabled', true);
					window.pcPersonalEditor.execute('editButton:show', this.$el.find('[data-resourcekey]'));
				}
			}

			this.updatePreviousVisibility();
		},
		keyDown: function(e) {

			if (e.keyCode === 13 && !e.shiftKey) {
				if (e.ctrlKey) {
					this.ui.textInput.val(this.ui.textInput.val() + "\n");
					return true;
				} else {

					this.triggerMethod("typingChange", false);
					this.activity = false;

					// start your submit function
					this.ui.form.submit();
					return false;
				}
			}
			return true;
		},
		keyUp: function() {
			var self = this;
			if (self.typingTimeout) {
				clearTimeout(self.typingTimeout);
				self.typingTimeout = null;
			}
			this.typingTimeout = setTimeout(function() {
				try {
					if (self.ui.textInput.val() != '') {
						self.activity = true;
						self.triggerMethod("typingChange", true);
					} else {
						self.triggerMethod("typingChange", false);
						self.activity = false;
					}
				} catch (ex) {
				}
			}, 2000);

			if (self.ui.textInput.val() != '') {
				if (self.activity != true) {
					//t.widget.SetTypingIndicator(true);
					self.triggerMethod("typingChange", true);
					self.activity = true;
				}
			}
		},
		postMessage: function(e) {
			e.stopPropagation();
			e.preventDefault();
			var newMessage = this.ui.textInput.val();
			this.triggerMethod("newMessage", newMessage);
			this.ui.textInput.val("");
			try {
				this.ui.textInput.autocomplete('close');
			} catch (ex) {

			}
		},
		typing: function(userId, userDisplayName, isTyping) {
			this.model.get('participants').set({ userId: userId, displayName: userDisplayName, isTyping: isTyping }, { remove: false });
			this.ui.userStatus.html(this.model.get('participants').getOperatorTypingText(this));
			if (isTyping) {
				if (this.options.settings.get('isPersonalChat') && this.options.settings.get('isInEditorMode')) {
					this.ui.userStatus.find('[data-resourcekey="chat_typing"]').attr('data-username', _.escape(userDisplayName));
					window.pcPersonalEditor.execute('editButton:show', this.ui.userStatus.find('[data-resourcekey]'));
				}
			}
		},
		appendBuffer: function(compositeView, buffer) {
			var $container = this.getItemViewContainer(compositeView);
			$container.append(buffer);
		},
		appendHtml: function(compositeView, itemView, index) {
			if (compositeView.isBuffering) {
				compositeView.elBuffer.appendChild(itemView.el);
			} else {
				// If we've already rendered the main collection, just
				// append the new items directly into the element.
				var $container = this.getItemViewContainer(compositeView);
				var last = $container.find('.purechat-message-wrapper').last();
				if (last.length) {
					last.after(itemView.el);
				} else {
					$container.append(itemView.el);
				}
			}
		},
		destroy: function() {
			this.ui.displayContainer.off('scroll.displayContainer');
		}
	});
	Views.ClosedOperatorView = Views.MessageListView.extend({
		template: 'ClosedMessageOperator',
		className: 'message-list-view closed-operator-container',
		templateHelpers: function() {
			var self = this;
			return $.extend({
				getExportParams: function() {
					var data = {
						'chatId': self.options.settings.get('room').id,
						'visitorEmail': self.options.settings.get('room').visitorEmail,
						'visitorIPAddress': self.options.settings.get('room').visitorIPAddress,
						'visitorPhoneNumber': self.options.settings.get('room').visitorPhoneNumber,
						'visitorFirstName': self.options.settings.get('room').visitorFirstName,
						'visitorLastName': self.options.settings.get('room').visitorLastName
					};
					return escape(JSON.stringify(data));
				},
			}, this.options.settings);
		},
		events: {
	    
		},
		initialize: function() {
			this._initialCollection = Marionette.getOption(this, 'chatModel').get('messages');
			this._proxyCollection = new Backbone.Collection();
			this.collection = new app.Models.MessageCollectionMessagesGrouped(null, { collection: this._proxyCollection });
		},
		onRender: function() {
			this.ui.messageListContainer.show();
		},
		renderMessageList: function() {
			var self = this;
			this._initialCollection.forEach(function(m) {
				self._proxyCollection.add(m);
			});
		}
	});
	Views.EmailForm = Marionette.ItemView.extend({
		template: 'EmailForm',
		className: 'purechat-start-chat-form',
		ui: {
			'form': '.purechat-form',
			'userDisplayName': '.purechat-name-input',
			'userDisplayFirstName': '.purechat-firstname-input',
			'userDisplayLastName': '.purechat-lastname-input',
			'userDisplayCompany': '.purechat-company-input',
			'email': '.purechat-email-input',
			'question': '.purechat-question-input',
			'userDisplayNameError': '.please-entername',
			'emailError': '.please-enteremail',
			'questionError': '.please-enterquestion',
			'phoneNumber': '.purechat-phonenumber-input',
			'unavailablePhoneNumber': '.purechat-unavailablephone-input',
			'phoneNumberError': '.please-enterphonenumber',
			'unavailablePhoneError': '.please-enterunavailablephone',
			userDisplayFirstNameError: '.please-enterfirstname',
			userDisplayLastNameError: '.please-enterlastname',
			userDisplayCompanyError: '.please-entercompany'
		},
		templateHelpers: function() {
			var self = this;
			return this.options.settings;
		},
		events: {
			'submit form': 'submitEmailForm'
		},
		submitEmailForm: function(e) {
			e.preventDefault();
			var self = this;
			if (this.submitDelay) {
				return;
			} else {
				this.submitDelay = true;
				setTimeout(function() {
					delete self.submitDelay;
				}, 500);
			}

			var askForFirstName = this.options.settings.get('AskForFirstName');
			var askForLastName = this.options.settings.get('AskForLastName');
			var askForPhoneNumber = this.options.settings.get('AskForPhoneNumber');
			var askForCompany = this.options.settings.get('AskForCompany');
			var userDisplayName = null;

			var userDisplayFirstName = null;
			if (askForFirstName)
				userDisplayFirstName = $.trim(this.ui.userDisplayFirstName.val());

			var userDisplayLastName = null;
			if (askForLastName)
				userDisplayLastName = $.trim(this.ui.userDisplayLastName.val());

			var userDisplayCompany = null;
			if (askForCompany)
				userDisplayCompany = $.trim(this.ui.userDisplayCompany.val());

			var userEmail = this.ui.email.val();

			var initialQuestion = this.ui.question.val();

			this.ui.form.find('[class*="please"]').hide();

			if (typeof userDisplayFirstName === 'string' && userDisplayFirstName.length == 0) {
				this.ui.userDisplayFirstNameError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userDisplayLastName === 'string' && userDisplayLastName.length == 0) {
				this.ui.userDisplayLastNameError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userEmail === 'string' && userEmail.length == 0) {
				this.ui.emailError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			if (typeof userDisplayCompany === 'string' && userDisplayCompany.length == 0) {
				this.ui.userDisplayCompanyError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}
			var phoneNumberVal = this.ui.phoneNumber.val();
			if (askForPhoneNumber) {
				if (phoneNumberVal.length == 0) {
					this.ui.phoneNumberError.show();
					self.options.viewController.triggerResizedEvent();
					return false;
				} else {
					this.ui.phoneNumberError.hide();
					self.options.viewController.triggerResizedEvent();
					this.ui.phoneNumber.val(phoneNumberVal);
				}
			}
			if (initialQuestion === null || $.trim(initialQuestion) == '') {
				this.ui.questionError.show();
				self.options.viewController.triggerResizedEvent();
				return false;
			}


			userDisplayFirstName = userDisplayFirstName || self.options.viewController.getPublicApi().get('visitor_firstName') || this.model.get('InitialVisitorFirstName') || 'Visitor';
			userDisplayLastName = userDisplayLastName || self.options.viewController.getPublicApi().get('visitor_lastName') || this.model.get('InitialVisitorLastName');
			userDisplayCompany = userDisplayCompany || self.options.viewController.getPublicApi().get('visitor_company') || this.model.get('InitialVisitorCompany');
			userEmail = userEmail || self.options.viewController.getPublicApi().get('visitor_email') || this.model.get('InitialVisitorEmail');
			initialQuestion = initialQuestion || self.options.viewController.getPublicApi().get('visitor_question') || this.model.get('InitialVisitorQuestion');
			phoneNumberVal = phoneNumberVal || self.options.viewController.getPublicApi().get('visitor_phonenumber') || this.model.get('InitialVisitorPhoneNumber');

			if (userDisplayFirstName) {

				userDisplayName = userDisplayFirstName;
				if (userDisplayLastName) {
					userDisplayName += userDisplayLastName;
				}
			} else if (userDisplayLastName) {
				userDisplayName = userDisplayLastName;
			} else {
				userDisplayName = "Visitor";
				userDisplayFirstName = "Visitor";
			}

			this.model.set({
				Name: userDisplayName,
				FirstName: userDisplayFirstName,
				LastName: userDisplayLastName,
				Company: userDisplayCompany,
				Email: userEmail,
				Question: initialQuestion,
				PhoneNumber: phoneNumberVal
			});
			this.model.trigger("formSubmit", {
				visitorName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayName || ''), true),
				visitorFirstName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayFirstName || ''), true),
				visitorLastName: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayLastName || ''), true),
				visitorCompany: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userDisplayCompany || ''), true),
				visitorEmail: app.Utils.escapeHtml(app.Utils.stripDangerousTags(userEmail || ''), true),
				visitorQuestion: app.Utils.escapeHtml(app.Utils.stripDangerousTags(initialQuestion || ''), false),
				visitorPhoneNumber: app.Utils.escapeHtml(app.Utils.stripDangerousTags(phoneNumberVal || ''), true)
			});
		},
		onRender: function() {

		}
	});
	Views.ClosedMessage = Marionette.ItemView.extend({
		getTemplate: function() {
			return this.options.settings.get('isOperator') ? 'ClosedMessageOperator' : 'ClosedMessage';
		},
		className: 'purechat-closedmessage-container',
		ui: {
			ratingThanks: ".purechat-rating-thanks",
			displayContainer: ".purechat-message-display-container",
			ratingPrompt: '[data-resourcekey="closed_askForRating"]'
		},
		templateHelpers: function() {
			return this.options.settings;
		},
		updateScroll: function() {
			var self = this;
			self.ui.displayContainer.scrollTop(self.ui.displayContainer[0].scrollHeight - self.ui.displayContainer.height());
		},
		events: {
			'click .purechat-thumbs-up': function(e) {
				if (!this.options.settings.get('isInEditorMode')) {
					$(e.target).addClass('purechat-thumbs-selected');
					this.rateChat(true);
				}
			},
			'click .purechat-thumbs-down': function(e) {
				if (!this.options.settings.get('isInEditorMode')) {
					$(e.target).addClass('purechat-thumbs-selected');
					this.rateChat(false);
				}
			},
			'click button.ban-ip-operator-button': function(e) {
				var sender = global$(e.target);
				global$('.operatorBanIPAddress[data-ipaddressid="' + sender.attr('data-ipaddressid') + '"]').modal('show');
				global$('#BanIP-' + sender.attr('data-ipaddressid')).off('click.BanIPAddressFromOperator').on('click.BanIPAddressFromOperator', function() {
					global$(document).trigger('ConfirmBanIPAddressFromOperator', [global$(this), sender]);
				});
			},
			'click .purechat-download-container a': function() {
				return !this.options.settings.get('isInEditorMode');
			}
		},
		rateChat: function(up) {
			if (!this.rating) {
				this.rating = up ? 1 : 0;
				this.trigger("chat:rated", this.rating);
			}

			this.$el.find('.purechat-thumbs-selectable:not(.purechat-thumbs-selected)').remove();
			this.ui.ratingThanks.text(this.getResource('closed_ratingThanks'));
			this.ui.ratingThanks.attr('data-resourcekey', 'closed_ratingThanks');
			if (this.ui.ratingPrompt.length > 0) {
				this.ui.ratingPrompt.hide();
			}
		},
		initialize: function() {
			this.model.set('isPersonalChat', this.options.settings.get('isPersonalChat'));
		},
		onClose: function() {
			// TODO: Need to perform this logic on each of the 3 views!
			if (this.options.settings.get('isPersonalChat') && this.options.settings.get('isInEditorMode') && window.pcPersonalEditor) {
				window.pcPersonalEditor.execute('editButton:hide', this.$el.find('[data-resourcekey]'));
			}
		},
		onRender: function() {
			if (this.options.settings.get('isPersonalChat')) {
				this.$el.find('a.purechat-cta-button').attr('href', /http/i.test(this.getResource('button_cta_url')) ? this.getResource('button_cta_url') : ('http://' + this.getResource('button_cta_url')));
				if (this.options.settings.get('isInEditorMode') && window.pcPersonalEditor) {
					window.pcPersonalEditor.execute('editButton:show', this.$el.find('[data-resourcekey]'));
				}
			}
		}
	});
	Views.CoolSpinner = Marionette.ItemView.extend({
		template: _.template(''),
		className: 'purechat-cool-awesome-spinner spinner'
	});
	Views.ChatConnectingView = Marionette.ItemView.extend({
		template: 'ChatConnecting',
		className: 'purechat-enterinfo-container',
		ui: {
			spinner: '.spinnerContainer',
			greeting: '.greeting',
			connecting: '.connecting'
		},
		onRender: function() {
			var spinnerOpts = {
				length: 20,
				radius: 20,
				width: 10,
				color: '#888'
			};
			if (this.options.settings.get('isPersonalChat')) {
				var spinner = new Views.CoolSpinner();
				spinner.render();
				this.ui.spinner.css('height', 'auto').append(spinner.$el);
				this.ui.greeting.css('display', 'none');
				this.ui.connecting.css('display', 'none');
			} else {
				var spinner = new purechatSpinner.Spinner(spinnerOpts).spin();
				var $spinner = $(spinner.el);
				$spinner.css({ left: '50%', top: '50%' });
				this.ui.spinner.append($spinner);
			}
		},
		showErrorMessage: function(error) {
			this.ui.spinner.hide();
			this.ui.greeting.hide();
			this.ui.connecting.hide();
			this.$el.append('<p>' + error + '</p>');
		}
	});
	Views.PersonalChatTooltip = Marionette.ItemView.extend({
		template: _.template('<span class="arrow"></span>'),
		tagName: 'span',
		className: 'personal-tooltip',
		onRender: function() {
			this.$el.append(this.model.get('text'));
		}
	});
	Views.PersonalChatDetails = Marionette.ItemView.extend({
		template: 'PersonalChatDetails',
		className: 'purechat-personal-widget-content',
		events: {
			'mouseenter .purechat-social-buttons a[data-tooltiptext]': 'displayFixedTooltip',
			'mouseleave .purechat-social-buttons a[data-tooltiptext]': 'hideFixedTooltip',
			'click .start-chat': 'showWidgetBody'
		},
		showWidgetBody: function() {
			var self = this;
			this.$el.parent().css({
				left: -$(window).width()
			});
			setTimeout(function() {
				self.$el.parent().addClass('purechat-hide');
			}, 1001);
		},
		displayFixedTooltip: function(e) {
			var sender = $(e.currentTarget);
			var tooltip = new Views.PersonalChatTooltip({
				model: new Backbone.Model({
					text: sender.data('tooltiptext')
				})
			});
			tooltip.render();
			tooltip.$el.appendTo('body');
			var top = sender.offset().top + sender.outerHeight() - 1;
			var right = sender.offset().left + (sender.width() / 2) - 8;
			tooltip.$el.css({
				display: 'inline-block',
				top: top,
				left: right
			});
			sender.data('activetooltip', tooltip);
		},
		hideFixedTooltip: function(e) {
			var sender = $(e.currentTarget);
			var tooltip = sender.data('activetooltip');
			if (tooltip) {
				tooltip.destroy();
				sender.data('activetooltip', null);
			}
		},
		initialize: function() {
			if (typeof tempPersonalWidgetSettings !== 'undefined') {
				var userWidgetSettings = this.model.get('UserWidgetSettings');
				for (var prop in tempPersonalWidgetSettings.attributes) {
					userWidgetSettings.set(prop, tempPersonalWidgetSettings.get(prop) || userWidgetSettings.get(prop));
				}
				this.model.set('UserWidgetSettings', userWidgetSettings);
			}
		},
		onRender: function() {
			if (this.options.model.get('RequestFromMobileDevice')) {
				this.$el.find('.purechat-contact-details a').addClass('button');
			}
		},
		onAfterInserted: function() {

		}
	});
	Views.UnsupportedBrowser = Marionette.ItemView.extend({
		template: 'UnsupportedBrowser',
		className: 'purechat-unsupported-browser',
		onRender: function() {

		}
	});
}, purechatApp.Models);


purechatApp.templates = templates;

//Clean up the clobal namespace;
var pc_ = _.noConflict();
var backbone = Backbone.noConflict();
var marionette = Marionette.noConflict();

var defaultUiVisiblity = {
	popoutButton: false,
	closeButton: false,
	restartButton: false,
	removeWidgetButton: false,
	requeueButton: false,
	leaveButton: false,
	cannedResponsesButton: false
};


var DEFAULT_AVAIL_TIMEOUT = 20 * 1000;
var DEFAULT_UNAVAIL_TIMEOUT = 10 * 60 * 1000;

// As crappy as this is, maintain a scoped reference to an array of poll intervals because the WidgetState isn't always getting disposed properly,
// So a timeout is still being called even when we don't want it to
var pollIntervals = [];

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {

States.PCWidgetState = marionette.Controller.extend({
	initialize: function () {
		this.stateSettings = this.stateSettings || {};
		this.stateSettings.UiVisiblity = this.stateSettings.UiVisiblity || {};
		pc_.defaults(this.stateSettings.UiVisiblity, defaultUiVisiblity);
	},
	setChatModel: function (model) {
		this.chatModel = model;
	},
	getChatModel: function () {
		return this.chatModel;
	},
	setWidgetView: function (view) {
		this.widgetView = view;
		this.listenTo(this.widgetView, "all");
	},
	setPersonalDetailsView: function (view) {
		this.personalDetailsView = view;
	},
	getPersonalDetailsView: function () {
		return this.personalDetailsView;
	},
	getWidgetView: function () {
		return this.widgetView;
	},
	setWidgetSettings: function (settings) {
		this.settings = settings;
	},
	getWidgetSettings: function () {
		return this.settings;
	},
	setResources: function (resources) {
		this.resources = resources;
	},
	getResources: function () {
		return this.resources;
	},
	setDataController: function (dc) {
		this.dc = dc;
	},
	getDataController: function () {
		return this.dc;
	},
	setViewController: function (vc) {
		this.vc = vc;
	},
	getViewController: function () {
		return this.vc;
	},
	getResource: function (key, data) {
		return this.resources.getResource(key, data);
	},
	disable: function () {
		this.getDataController().connectionInfo.set('disabled', true);
		this.getDataController().connectionInfo.set('chatActiveInOtherWindow', true);
		this.getWidgetView().$el.hide();
	},
	enable: function () {
		this.getDataController().connectionInfo.set('disabled', false);
		this.getDataController().connectionInfo.set('chatActiveInOtherWindow', false);
		this.getWidgetView().$el.show();
	},
	syncWithContact: function () {
		var d = $.Deferred()
		var self = this;
		this.getDataController()
			.getContactInfo()
			.done(function (info) {
				if (info && (!window.pcPersonalEditorSettings || !window.pcPersonalEditorSettings.get('isInEditorMode'))) {
					self.getChatModel().set('visitorFirstName', info.firstName);
					self.getChatModel().set('visitorLastName', info.lastName);
					self.getChatModel().set('visitorCompany', info.company);
					self.getChatModel().set('visitorEmail', info.email);
					self.getChatModel().set('visitorPhoneNumber', info.phone);
				}
				d.resolve();
			});
		return d.promise();
	},
	showConnectingWithTimeout: function () {
		var self = this;

		function show() {
			//Double check that the timeout wasn't cleared;
			//This can happend if the timeout expires and the current running code 
			//clears it before executing this.
			if (this.connectingTimeout) {
				var connectingView = new purechatApp.Views.ChatConnectingView({
					rm: self.getResources(),
					model: new backbone.Model({}),
					settings: self.options
				});
				self.getWidgetView().content.show(connectingView);
			}
		}

		this.clearConnectingTimeout();
		this.connectingTimeout = setTimeout(show, 500);
		var localTimeout = this.connectingTimeout;
	},
	clearConnectingTimeout: function () {
		if (this.connectingTimeout) {
			clearTimeout(this.connectingTimeout);
			delete this.connectingTimeout;
		}
	},
	//events
	onEnter: function () {
		this.listenTo(this.getWidgetView(), 'all', function (event, parms) {
			var self = this;
			if (parms && parms.confirmation) {

				self.getViewController().showConfirmationDialog(parms.confirmation, parms.title)
					.done(function () {
						self.triggerMethod.call(self, event, parms);
					});
			} else {
				this.triggerMethod.apply(this, arguments);
			}

		});

		var self = this;
		if (this.stateSettings) {
			if (this.stateSettings.UiVisiblity) {
				var view = this.getWidgetView();
				for (var next in this.stateSettings.UiVisiblity) {
					if (view.ui[next]) {
						view.ui[next].toggle(this.stateSettings.UiVisiblity[next]);
					}
				}
			}
			var dc = self.getDataController();
			var connectionInfo = dc.connectionInfo;
			var shouldBeInRoom = this.stateSettings.shouldBeInRoom;
			if (!this.chatModel.get('isOperator') && !pc_.isUndefined(shouldBeInRoom)) {
				if (shouldBeInRoom) {
					this.listenTo(connectionInfo, "change:isInChat", function (model, isInChat) {
						if (!isInChat) {
							self.chatModel.set('state', purechatApp.Constants.WidgetStates.Closed);
						}
					});
				} else {
					this.listenTo(connectionInfo, "change:isInChat", function (model, isInChat) {
						if (isInChat) {
							self.widgetView.expand();
							self.chatModel.set('state', purechatApp.Constants.WidgetStates.Chatting);
						}
					});

				}
			}
		}
		this.listenTo(this.options, 'change:enableAvailabilityPolling', function (model, startPolling) {
			if (startPolling) {
				// Only start polling immediately if we're in the inactive state
				switch (self.name) {
					case 'inactive':
						self.startAvailabilityPolling(true);
						break;
					default:
						break;
				}
			} else {
				// Stop polling if this was set AND the widget is currently collapsed, regardless of state
				if (!self.getChatModel().get('expanded') && self.TestingStartedFromApi) {
					self.stopAvailabilityPolling();
				}
			}
		});
	},
	onExit: function () {
		this.clearConnectingTimeout();
		this.stopListening(this.widgetView, "all");
		this.stopAvailabilityPolling(true);
	},
	clearPolling: function () {
		var self = this;
		pollIntervals.forEach(function (p) {
			clearInterval(p);
		});
		pollIntervals = [];
	},
	// TODO: How do we make enabling polling more reliable so that it doesn't happen all the effing time and bloat the hell out of the dom?
	testAvailability: function () {
		var t = this;
		if (t.getViewController().pageActivity || (t.lastCheck && (new Date() - t.lastCheck) > 120000)) {
			t.lastCheck = new Date();
			t.getDataController()
				.checkChatAvailable()
				.done(function (result) {
					t.clearPolling();
					t.checkAvailTimeout = result.available ? DEFAULT_AVAIL_TIMEOUT : DEFAULT_UNAVAIL_TIMEOUT;
					if (result.available) {
						pollIntervals.push(setTimeout(function () { t.testAvailability(); }, t.checkAvailTimeout));
					} else {
						if (result.reason !== 'AccountActivity') {
							pollIntervals.push(setTimeout(function () { t.testAvailability(); }, t.checkAvailTimeout));
						} else {
							t.stopAvailabilityPolling();
						}
					}
					t.getChatModel().set('operatorsAvailable', result.available);
				});
		} else {
			//If there is now activity we want to test faster so that the widget updates itself quickly
			//When they return to our page.
			t.checkAvailTimeout = DEFAULT_AVAIL_TIMEOUT;
			t.clearPolling();
			pollIntervals.push(setTimeout(function () { t.testAvailability(); }, 1500));
		}
	},
	startAvailabilityPolling: function (fromApi) {
		var t = this;
		// Kill all polls first!
		t.clearPolling();
		t.checkAvailTimeout = DEFAULT_AVAIL_TIMEOUT;
		t.testAvailability();
		if (!this.TestingStatus) {
			pollIntervals.push(setTimeout(function () { t.testAvailability(); }, t.checkAvailTimeout));
		}
		this.TestingStatus = true;
		this.TestingStartedFromApi = fromApi || false;
	},
	stopAvailabilityPolling: function (forceStop) {
		if (!this.options.get('enableAvailabilityPolling') || this.name == 'chatting' || this.name == 'activating' || forceStop) {
			this.TestingStatus = false;
			this.clearPolling();
		}
	},
	onPopOutChat: function () {
		var settings = this.getWidgetSettings();
		var chatModel = this.getChatModel();
		var dataController = this.getDataController();

		this.getChatModel().set('poppedOut', true);

		//todo need the disable stuff to work
		this.disable();
		dataController.connectionInfo.persistLocalStorage();

		window.openedWindow = window.open(this.settings.get('pureServerUrl') + '/VisitorWidget/ChatWindow' +
			'?widgetId=' + settings.get('widgetId') +
			'&userId=' + dataController.connectionInfo.get('userId') +
			'&displayName=' + dataController.connectionInfo.get('visitorName') +
			'&authToken=' + dataController.connectionInfo.get('authToken') +
			'&roomId=' + dataController.connectionInfo.get('roomId') +
			'&chatId=' + dataController.connectionInfo.get('chatId') +
			'&origin=' + encodeURIComponent(chatModel.get('origin')),
			'purechatwindow', 'menubar=no, location=no, resizable=yes, scrollbars=no, status=no, width=480, height=640');
		this.getViewController().trigger('widget:poppedOut');
	}
});

}, purechatApp.Models)
purechatApp.module("Controllers.States", function(States, app, Backbone, Marionette, $, _, Models) {
	// This is an intermediate state that can be used when transitioning from the in-chat state 
	// when the chat isn't answered in a set amount of time
	States.PCStateEmailForm = States.PCWidgetState.extend({
		name: 'emailForm',
		initialize: function() {
			States.PCWidgetState.prototype.initialize.apply(this, arguments);
		},
		UiVisibility: {
			popoutButton: true,
			closeButton: true,
			requeueButton: true
		},
		buildInitialQuestionFromMessageList: function() {
			var userId = this.chatModel.get('userId');
			var myMessages = this.chatModel.get('messages').filter(function(m) {
				return m.get('userId') == userId;
			});
			var message = '';
			// Currently, the email cannot handle new lines, so let's just put a white space here
			myMessages.forEach(function(m) {
				if (message.length == 0) {
					message = m.get('message');
				} else {
					message += ' ' + m.get('message');
				}
			});
			return message;
		},
		onEnter: function() {
			var initialQuestion = this.buildInitialQuestionFromMessageList();
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			var self = this;
			var widgetView = this.getWidgetView();
			// content.show() to show a new view in the widget layout
			self.getWidgetView().setTitle(self.getResource('title_emailForm'), 'title_emailForm');
			var model = new backbone.Model({
				UnavailableAskForPhone: self.settings.get('UnavailableAskForPhone'),
				EmailForm: true,
				InitialVisitorName: self.getViewController().getChatModel().get('visitorName') || '',
				InitialVisitorFirstName: self.getViewController().getChatModel().get('visitorFirstName') || '',
				InitialVisitorLastName: self.getViewController().getChatModel().get('visitorLastName') || '',
				InitialVisitorCompany: self.getViewController().getChatModel().get('visitorCompany') || '',
				InitialVisitorEmail: self.getViewController().getChatModel().get('visitorEmail') || '',
				InitialVisitorQuestion: initialQuestion || self.getViewController().getChatModel().get('visitorQuestion') || '',
				InitialVisitorPhoneNumber: self.getViewController().getChatModel().get('visitorPhoneNumber') || ''
			});
			model.on("formSubmit", function(data) {
				var form = $(self.getWidgetView().el).find('.purechat-form.purechat-email-form');
				app.execute('spinner:show', form);
				self.getDataController()
					.submitEmailForm(data)
					.done(function(result) {
						if (result.success) {
							var emailSent = new purechatApp.Views.EmailSent({ rm: self.getResources(), model: model });
							self.getWidgetView().content.show(emailSent);
							self.getWidgetView().ui.restartButton.show();
							self.getWidgetView().$el.find('.btn-restart').on('click.RestartChat', function(e) {
								self.restartChat.call(self, e);
							});
							self.getViewController().trigger('email:send', data);
						} else {
							form.find('.purechat-email-error').css({
								display: 'block'
							});
						}
					})
					.fail(function() {

					}).always(function() {
						app.execute('spinner:hide', form);
					});
			});
			var emailForm = new app.Views.EmailForm({
				viewController: self.getViewController(),
				rm: self.getResources(),
				settings: self.options,
				chatModel: self.chatModel,
				model: model
			});
			widgetView.content.show(emailForm);
			widgetView.onShow();
		},
		onExpanded: function() {
			this.getWidgetView().setTitle(this.getResource('title_emailForm'), 'title_emailForm');
		},
		onCollapsed: function() {
			this.getWidgetView().setTitle(this.getResource('title_initial'));
		},
		restartChat: function(e) {
			e.stopPropagation();
			var sender = $(e.currentTarget);
			var self = this;
			sender.off('click.RestartChat');
			self.getDataController()
				.restartChat()
				.done(function() {
					self.getChatModel().restartChat();
					self.getViewController().resetVisitorQuestion();
					self.getViewController().trigger('widget:restart');
				})
				.fail(function() {
					//todo actual implementation
					throw new Error('Failed to send email. Please try again!');
				});
		},
		onExit: function() {
			States.PCWidgetState.prototype.onExit.apply(this, arguments);
			if (this.unbindEvents)
				this.unbindEvents();
		}
	});

}, purechatApp.Models);

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {


	States.PCStateInitializing = States.PCWidgetState.extend({
		name: 'initializing',
		stateSettings: {
			UiVisiblity: {

			}
		},
		onEnter: function () {
			var self = this;
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			this.getWidgetView().setTitle(this.getResource('title_initial_open'), 'title_initial_open');
			var inRoom = this.getDataController().checkInRoom();


			var re = new RegExp("^https?://" + document.location.hostname, "i");

			if (!document.referrer.match(re)) {
				localStorage.acquisitionSource = document.referrer;
			}

			this.syncWithContact().done(function () {
				if (inRoom) {
					self.getChatModel().set('state', app.Constants.WidgetStates.Activating);
				} else {
					self.getChatModel().set('state', app.Constants.WidgetStates.Inactive);
				}
			});
		}
	});


}, purechatApp.Models);

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {


	/*
	The state before a chat is started. Features a textbox for the user to enter their name and a button
	to begin the chat. Switches the widget state to InitializingState upon the button being pressed
	*/
	var inactiveInstance = null;
	States.PCStateInactive = States.PCWidgetState.extend({
		name: 'inactive',
		stateSettings: {
			shouldBeInRoom: false,
			UiVisiblity: {

			}
		},
		onEnter: function () {
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			var self = inactiveInstance = this;
			var widgetSettings = self.getWidgetSettings();
			var doneFnc = function (result) {
				var chatModel = self.getViewController().getChatModel();
				self.getWidgetView().$el.find('.purechat-start-chat-button-container button').html('Start Chat');
				if (!result.available) {
					if (result.reason == 'WidgetDisabled' || result.reason == 'ChatQuotaExceeded' || result.reason == 'IpIsbanned') {
						self.getWidgetSettings().set('UnavailableBehavior', 1);
					}
				}
				if (self.options.get('isPersonalChat') && !self.getPersonalDetailsView()) {
					self.personalDetails = new app.Views.PersonalChatDetails({
						model: self.options
					});
					self.getWidgetView().personalDetails.show(self.personalDetails);
					self.setPersonalDetailsView(self.personalDetails);
					self.personalDetails.triggerMethod('afterInserted');
				}
				chatModel.set('operatorsAvailable', result.available);
				var isDemo = self.options.get('isDemo');
				var goToEmailForm = isDemo && self.options.get('requestedState') == app.Constants.WidgetStates.EmailForm;
				if (result.available) {
					self.getWidgetView().onShow();
					self.getWidgetView().setTitle(self.getResource('title_initial'), 'title_initial');
					var model = new backbone.Model({
						AskForFirstName: self.getWidgetSettings().get('AskForFirstName'),
						AskForLastName: self.getWidgetSettings().get('AskForLastName'),
						AskForEmail: self.getWidgetSettings().get('AskForEmail'),
						AskForCompany: self.getWidgetSettings().get('AskForCompany'),
						AskForQuestion: self.getWidgetSettings().get('AskForQuestion'),
						AskForPhoneNumber: self.getWidgetSettings().get('AskForPhoneNumber'),
						InitialVisitorFirstName: chatModel.get('visitorFirstName') || '',
						InitialVisitorLastName: chatModel.get('visitorLastName') || '',
						InitialVisitorEmail: chatModel.get('visitorEmail') || '',
						InitialVisitorCompany: chatModel.get('visitorCompany') || '',
						InitialVisitorQuestion: chatModel.get('visitorQuestion') || '',
						InitialVisitorPhoneNumber: chatModel.get('visitorPhoneNumber') || ''
					});
					var viewConstructor = !self.getWidgetSettings().get('StartChatImmediately') ?
						purechatApp.Views.StartChatForm :
						purechatApp.Views.StartChatFormAutomatically;
					self.chatForm = new viewConstructor({
						viewController: self.getViewController(),
						rm: self.getResources(),
						model: model,
						settings: self.options
					});
					model.on("formSubmit", function (data) {
						self.getViewController().onFormSubmitted(data);
					});
					if (self.settings.browserIsUnsupported()) {
						chatModel.set('state', app.Constants.WidgetStates.Unsupported);
					} else if (goToEmailForm) {
						chatModel.set('state', app.Constants.WidgetStates.EmailForm);
					} else {
						self.getWidgetView().content.show(self.chatForm);
						self.listenTo(chatModel, "change:operatorsAvailable", function (model, available) {
							if (!available) {
								chatModel.set('state', app.Constants.WidgetStates.Unavailable);
							}
						});
						self.listenTo(chatModel, 'change', function (cModel) {
							model.set({
								InitialVisitorName: cModel.get('visitorName') || '',
								InitialVisitorFirstName: cModel.get('visitorFirstName') || '',
								InitialVisitorLastName: cModel.get('visitorLastName') || '',
								InitialVisitorEmail: cModel.get('visitorEmail') || '',
								InitialVisitorCompany: cModel.get('visitorCompany') || '',
								InitialVisitorQuestion: cModel.get('visitorQuestion') || '',
								InitialVisitorPhoneNumber: cModel.get('visitorPhoneNumber') || ''
							});
						});
						if (self.widgetView.model.get('expanded') || self.getWidgetSettings().get('UnavailableBehavior') == 0) {
							if (self.widgetView.model.get('expanded')) {
								self.getWidgetView().setTitle(self.getResource('title_initial_open'), 'title_initial_open');
							}
							if (!window._pcDisableAvailabilityPings) {
								self.startAvailabilityPolling();
							}
						}
						if (self.options.get('enableAvailabilityPolling')) {
							self.startAvailabilityPolling();
						}
					}
				} else {
					if (goToEmailForm) {
						chatModel.set('state', app.Constants.WidgetStates.EmailForm);
					} else {
						chatModel.set('state', app.Constants.WidgetStates.Unavailable);
					}
				}
				app.execute('poweredby:reset');
			};
			self.getDataController().checkChatAvailable().done(doneFnc);
		},
		onExit: function () {
			// Cleanup events we don't need anymore on the chat model for repeat chats so we don't have a leakey bucket
			States.PCWidgetState.prototype.onExit.apply(this, arguments);
			this.stopListening(this.getViewController().getChatModel());
		},
		onExpanded: function () {
			var inRoom = this.getDataController().checkInRoom();

			if (inRoom) {
				this.getChatModel().set('state', app.Constants.WidgetStates.Activating);
			} else {
				this.getWidgetView().setTitle(this.getResource('title_initial_open'), 'title_initial_open');
				if (!window._pcDisableAvailabilityPings) {
					this.startAvailabilityPolling();
				}
			}
		},
		onCollapsed: function () {
			this.getWidgetView().setTitle(this.getResource('title_initial'), 'title_initial');
			if (this.getWidgetSettings().get('UnavailableBehavior') != 0) {
				this.stopAvailabilityPolling();
			}
		},
		startChatAutomatically: function () {
			var d = $.Deferred();
			var self = this;
			var mockData = {
				visitorName: 'Visitor'
			};
			var widgetSettings = self.getWidgetSettings();
			self.getDataController().checkChatAvailable().done(function (response) {
				self.getChatModel().set('operatorsAvailable', response.available);
				if (response.available) {
					self.getDataController().startChat(mockData).done(function (chatConnectionInfo) {
						purechatApp.Utils.GaEvent(widgetSettings, 'GaTrackingChat', 'GAChatEvent');
						self.getWidgetView().$el.find('.purechat-init-form').find('.general-error').text('').hide();
						self.status.chatInfo = chatConnectionInfo;
						self.status.initialData = mockData;
						self.getChatModel().set('visitorName', mockData.visitorName);
						self.getChatModel().set('visitorEmail', mockData.visitorEmail);
						self.getChatModel().set('visitorQuestion', mockData.visitorQuestion);
						self.getChatModel().set('roomId', chatConnectionInfo.get('roomId'));
						self.getChatModel().set('userId', chatConnectionInfo.get('userId'));
						self.getChatModel().set('authToken', chatConnectionInfo.get('authToken'));
						self.getChatModel().set('chatId', chatConnectionInfo.get('chatId'));
						self.getChatModel().set("state", app.Constants.WidgetStates.Chatting);
						self.getDataController().connectionInfo.persistLocalStorage();
						d.resolve();
					}).fail(function (message) {
						self.log("Error", "Unable to start chat. WidgetId: " + self.getWidgetSettings().get('widgetId') + ", Message:" + (message || "None"));
						var widgetView = self.getWidgetView();
						widgetView.$el.find('.purechat-init-form').find('.general-error').text('Unable to start chat. Please try again').show();
						d.reject();
					}).always(function () {
						self.submittingChat = false;
					});
				} else {
					self.getChatModel().set('state', app.Constants.WidgetStates.Unavailable);
					d.resolve();
				}
			});
			return d.promise();
		}
	});
	States.addInitializer(function () {
	});
	States.addFinalizer(function () {
	});
}, purechatApp.Models);

purechatApp.module("Controllers.States", function(States, app, Backbone, Marionette, $, _, Models) {


	/*
	The activating state. Presents a loading/please-wait screen to the user, then makes the necessary handshakes to connect to a chat room.
	
	If userId and authToken are specified, this will connect to the chat server with those credentials. If they are not specified, this
	will connect to Pure Server to obtain those credentials before connecting to the chat server.
	*/
	States.PCStateActivating = States.PCWidgetState.extend({
		name: 'activating',
		stateSettings: {
			UiVisiblity: {
            
			}
		},
		onEnter: function() {
			var self = this;
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);

			var m = new backbone.Model({
				userName: self.getChatModel().get('visitorName')
			});
			if (self.options.get('isPersonalChat') && !self.getPersonalDetailsView()) {
				self.personalDetails = new app.Views.PersonalChatDetails({
					model: self.options
				});
				self.getWidgetView().personalDetails.show(self.personalDetails);
				self.setPersonalDetailsView(self.personalDetails);
				self.personalDetails.triggerMethod('afterInserted');
			}

			self.showConnectingWithTimeout();

			//this.getDataController()
			//    .connectToChatServer()
			//    .done(function () {
			self.clearConnectingTimeout();
			self.getChatModel().set("state", app.Constants.WidgetStates.Chatting);
			//})
			//.fail(function () {
			//    self.clearConnectingTimeout();
			//    //Connection failed,  remove the connection state
			//    self.getDataController().connectionInfo.clearLocalStorage();
			//    self.getChatModel().set("state", app.Constants.WidgetStates.Inactive);
			//});
		}
	});

}, purechatApp.Models);

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {
	function htmlDecode(value) {
		return $('<div/>').html(value).text();
	}

	States.PCStateChatting = States.PCWidgetState.extend({
		name: 'chatting',
		stateSettings: {
			shouldBeInRoom: true,
			UiVisiblity: {
				popoutButton: true,
				closeButton: true,
				requeueButton: true,
				cannedResponsesButton: true
			}
		},
		initialize: function () {
			States.PCWidgetState.prototype.initialize.apply(this, arguments);
			this.typing = {};
			this.isUserAlone = true;
			this.mobileAnimationInterval = null;
		},
		onEnter: function () {
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			var self = this;
			self.getWidgetView().$el.removeClass('purechat-button-hidden');
			if (self.options.get('isPersonalChat') && !self.getPersonalDetailsView()) {
				self.personalDetails = new app.Views.PersonalChatDetails({
					model: self.options
				});
				self.getWidgetView().personalDetails.show(self.personalDetails);
				self.setPersonalDetailsView(self.personalDetails);
				self.personalDetails.triggerMethod('afterInserted');
			}
			var m = new backbone.Model({
				userName: self.getChatModel().get('visitorName')
			});

			var startImmediately = this.options.get('StartChatImmediately');

			//This needs to be created ahead of time because as soon as
			//we connect the chat server will start sending messages
			var chatModel = self.getChatModel();
			chatModel.set({
				isPersonalChat: this.options.get('isPersonalChat'),
				RequestFromMobileDevice: this.options.get('RequestFromMobileDevice')
			});
			self.messageView = new purechatApp.Views.MessageListView({
				rm: this.getResources(),
				model: chatModel,
				collection: new app.Models.MessageCollectionMessagesGrouped(null, { collection: self.getChatModel().get('messages') }),
				settings: self.getWidgetSettings(),
				viewController: self.getViewController()
			});

			self.getWidgetView().content.show(self.messageView);


			self.listenTo(self.messageView, "showPrevious", function () {
				if (self.chatModel.get('PreviousTranscriptId')) {
					var previousChatDeferred = self.getDataController().getPreviousChat({ chatId: self.chatModel.get('PreviousTranscriptId') });

					previousChatDeferred.done(function (previousChatResult) {
						self.appendPreviousChatResults(previousChatResult);
					});
				}
			});


			self.showConnectingWithTimeout();
			var isMobile = self.options.get('RequestFromMobileDevice') && (self.options.get('poppedOut') || self.options.get('isDirectAccess'));

			var loading = [self.getDataController().connectToChatServer(this)];
			if (this.options.get('room') && this.options.get('room').roomType != 1 && !this.options.get('room').isDemo) {
				var previousChatDeferred = self.getDataController().getPreviousChat({ chatId: this.options.get('room') ? this.options.get('room').id : -1 });
				loading.push(previousChatDeferred);
			}

			$.when.apply($, loading).done(function (connectionResult, previousChatResult) {

				if (previousChatResult) { self.appendPreviousChatResults(previousChatResult); }

				self.clearConnectingTimeout();
				try {
					if (!self.chatModel.get('isOperator') && (typeof self.chatModel.get('operators') === 'undefined' || self.chatModel.get('operators').length == 0)) {
						var d = new Date();
						d.setTime(0);
						self.chatModel.get('messages').add({
							date: d,
							type: startImmediately ? 'message' : 'note',
							message: self.status && self.status.initialData && self.status.initialData.initiator && self.status.initialData.initiator == 1 ? "" : self.getResource('chat_startedMessage'),
							resourceKey: 'chat_startedMessage',
							avatarUrl: self.options.get('isPersonalChat') ? (personalAvatarUrl || '/content/images/avatars/1avatar-operator-skinny.png') : isMobile ? '/content/images/avatars/1avatar-operator-skinny.png' : null
						});
					}
					if (_.isFunction(self.getDataController().setCurrentPage) && !self.options.get('isOperator')) {
						self.getDataController().setCurrentPage(document.location.href);
					}

					self.messageView.on('newMessage', function (message) {
						self.getDataController().newMessage(message);
					});

					self.listenTo(self.messageView, "typingChange", function (typing) {
						self.getDataController().setTypingIndicator(typing);
					});

					self.getWidgetView().$el.find('.purechat-start-chat-button-container button').html('Back to Chat<i style="margin-left: .5em;" class="fa fa-chevron-right"></i>');
					self.getWidgetView().onShow();
					self.getDataController().sendRoomHistory();
					self.getViewController().trigger('stateChanged', app.Constants.WidgetStates.Chatting);
					if (self.settings.get('RequestFromMobileDevice') && self.settings.get('AllowWidgetOnMobile')) {
						$(window).trigger('resize.ResizeChatContent');
						self.getWidgetView().$el.find('.purechat-send-form-message').off('blur.ResizeWindow').on('blur.ResizeWindow', function () {
							$(window).trigger('resize.ResizeChatContent');
						});
						if (self.options.get('isDirectAccess')) {
							$('.direct-container-header').css('display', 'none');
							if (typeof resizeDirectAccessContainer === 'function') {
								resizeDirectAccessContainer();
							}
						}
					}
					if (!self.options.get('isDemo')) {
						self.getWidgetView().$el.find('.purechat-send-form-message').trigger('focus');
					}
					self.getWidgetView().trigger('resized');
					app.execute('poweredby:reset');
					self.getViewController().trigger('chat:start', chatModel.pick([
						'visitorEmail',
						'visitorName',
						'visitorPhoneNumber',
						'visitorQuestion',
						'visitorFirstName',
						'visitorLastName',
						'visitorCompany'
					]));
				} catch (exception) {
					console.log(exception);
				}
			}).fail(function () {
				self.clearConnectingTimeout();
				//Connection failed,  remove the connection state
				self.getDataController().connectionInfo.clearLocalStorage();
				self.getChatModel().set("state", app.Constants.WidgetStates.Inactive);
			});
			chatModel.on('roomHostChanged', function () {
				// Update the text and avatar in the header, if it exists
				var roomHostAvatarUrl = chatModel.get('roomHostAvatarUrl');
				var roomHostName = chatModel.get('roomHostName');
				self.getWidgetView().showRoomHostAvatar(roomHostAvatarUrl);
				self.getWidgetView().updateRoomHostName(roomHostName);
			});
		},
		onSelectionShow: function () {
			this.messageView.updateScroll();
		},
		appendPreviousChatResults: function (previousChatResult, delayIncrement) {
			var self = this;
			if (previousChatResult) {
				previousChatResult.forEach(function (next) {
					var lastTimeString = null;
					var lastMessage = null;

					var currentDelay = 0

					next.Records.forEach(function (nextMessage) {
						function triggerOnMessage() {

							if (nextMessage.Type == 1) {
								self.onJoined(nextMessage.UserId, nextMessage.Name, -1, nextMessage.Name, nextMessage.DateCreatedJsTicks / 1000, true, true);
							} else if (nextMessage.Type == 2) {
								self.onLeft(nextMessage.UserId, nextMessage.Name, -1, nextMessage.Name, nextMessage.DateCreatedJsTicks / 1000, true, true);
							} else {
								self.onMessage(nextMessage.UserId, nextMessage.Name, -1, nextMessage.Name, nextMessage.DateCreatedJsTicks / 1000, nextMessage.Message, true, 0, 0, nextMessage.AvatarUrl, nextMessage.UserId > 0, 0, 0, true);
							}
						}

						if (delayIncrement) {
							setTimeout(triggerOnMessage, currentDelay);
							currentDelay = currentDelay + delayIncrement;
						} else {
							triggerOnMessage();
						}

						lastTimeString = nextMessage.DateCreatedString + " at " + nextMessage.TimeCreatedString;
						lastMessage = nextMessage;
					});
					if (lastTimeString != null) {

						var date = new Date();
						date.setTime(lastMessage.DateCreatedJsTicks);

						function addSeparator() {
							date = self.convertToUserTime(date);
							self.chatModel.get('messages').add({ date: date, type: 'separator', message: lastTimeString, isClosedChat: true });
						}

						if (delayIncrement) {
							setTimeout(addSeparator, currentDelay);
							currentDelay = currentDelay + delayIncrement;
						} else {
							addSeparator();
						}
					}

					self.chatModel.set("PreviousTranscriptId", next.Id);
					if (next.PreviousTranscriptId) {
						self.chatModel.set("HasMoreTransactions", true);
					} else {
						self.chatModel.set("HasMoreTransactions", false);
					}
				});
			}
		},
		onExit: function () {
			States.PCWidgetState.prototype.onExit.apply(this, arguments);
			if (this.unbindEvents) {
				this.unbindEvents();
			}
			this.getDataController().unbindHandlerEvents();
		},
		onRoomChanged: function (args) {
			this.onRoomDetailsChanged(args.room);
		},
		onCloseChat: function (skipPrompt) {
			var self = this;
			var onCloseFnc = function (context) {
				context.getDataController()
					.closeChat()
					.done(function () {
						context.getChatModel().set('state', app.Constants.WidgetStates.Closed);
					})
					.fail(function () {
						//todo actual implementation
						alert('fail');
					});
			};
			var confirmModal = self.getWidgetView().$el.find('.purechat-confirm-close-modal');
			var modalOverlay = self.getWidgetView().$el.find('.purchat-confirm-close-modal-overlay');
			if (!skipPrompt && self.settings.useMobile() && !self.settings.isDesktopDimension()) {
				confirmModal.css({
					display: 'block'
				});
				modalOverlay.css({
					display: 'block'
				});
				confirmModal.find('.modal-button-bar .btn').off('click.PerformModalAction').on('click.PerformModalAction', function () {
					var sender = $(this);
					if (sender.hasClass('kill-chat')) {
						onCloseFnc(self);
					}
					confirmModal.css({
						display: 'none'
					});
					modalOverlay.css({
						display: 'none'
					});
				});
			} else {
				onCloseFnc(self);
			}
		},
		onExpanded: function () {
			//this.messageView.scrollToTop();
		},
		flashMobileNotificationIcon: function () {
			var self = this;
			if (this.settings.get('RequestFromMobileDevice') && this.settings.get('AllowWidgetOnMobile') && typeof this.mobileAnimationInterval !== 'number') {
				var elem = this.getWidgetView().$el;
				var triggerElems = elem.hasClass('purechat-widget-collapsed') && elem.find('.purechat-expanded').is(':visible') ? elem : [];
				if (triggerElems.length > 0) {
					var visibleIcon = elem.find('.purechat-title-image-out-of-way-hilight').filter(':visible');
					visibleIcon.addClass('flash');
					var isFlashing = true;
					//$('.purechat-widget .purechat-widget-header, .purechat-window .purechat-widget-header, .purechat-widget .purechat-expanded, .purechat-widget .purechat-collapsed-outer, .purechat-widget .purechat-expanded .purechat-widget-inner, .purechat-widget .purechat-collapsed-outer .purechat-widget-inner').addClass('no-background');
					this.mobileAnimationInterval = setInterval(function () {
						if (isFlashing) {
							visibleIcon.removeClass('flash');
							isFlashing = false;
						} else {
							visibleIcon.addClass('flash');
							isFlashing = true;
						}
					}, 1000);
					triggerElems.off('click.StopNotification').on('click.StopNotification', function (e) {
						var sender = $(e.currentTarget);
						self.mobileAnimationInterval = clearInterval(self.mobileAnimationInterval);
						visibleIcon.removeClass('flash');
						triggerElems.off('click.StopNotification');
						sender.trigger('click');
					});
				}
			}
		},
		convertToUserTime: function (date) {
			if (typeof CurrentUser !== 'undefined' && CurrentUser !== null) {
				// We are on the dashboard, so we can use the CurrentUser to get the UTC offset
				var isInDaylightSavings = CurrentUser.get('isInDaylightSavings');
				var utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
				date = new Date(utcDate.getTime() + ((CurrentUser.get('accountUtcOffset') + (isInDaylightSavings ? 60 : 0)) * 60000));
			}
			return date;
		},
		onMessage: function (userId, userDisplayName, roomId, roomDisplayName, time, message, isHistory, timeElapsed, protocolVersion, senderAvatarUrl, fromOperator, roomUtcOffset, messageId, isClosedChat) {
			var myAvatarUrl = this.settings.get('avatarUrl');
			if (this.chatModel.get('isOperator') && userId != this.chatModel.get('userId')) {
				notifier.notify('New message!');
			}
			// Add the message to the display area
			if (message !== null && typeof message === 'string') {
				var date = new Date();
				date.setTime(time * 1000);
				//if (typeof CurrentUser !== 'undefined' && CurrentUser !== null) {
				//	// We are on the dashboard, so we can use the CurrentUser to get the UTC offset
				//	var isInDaylightSavings = CurrentUser.get('isInDaylightSavings');
				//	var utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
				//	date = new Date(utcDate.getTime() + ((CurrentUser.get('accountUtcOffset') + (isInDaylightSavings ? 60 : 0)) * 60000));
				//}
				date = this.convertToUserTime(date);
				this.chatModel.get('messages').add({
					date: date,
					type: 'message',
					message: message,
					userName: userDisplayName,
					myMessage: userId == this.chatModel.get('userId'),
					time: date.toHourMinuteString(),
					avatarUrl: senderAvatarUrl,
					fromOperator: fromOperator,
					visitorAvatarUrl: this.settings.get('room') && this.settings.get('room').visitorAvatarUrl ? this.settings.get('room').visitorGravatarHash : '',
					rootUrl: this.chatModel.get('cdnServerUrl'),
					userId: userId,
					messageId: messageId,
					isClosedChat: isClosedChat
				});
				if (userId != this.chatModel.get('userId') && !isHistory) {
					app.execute('notifications:newMessage');
				}
			}
			if (this.chatModel.get('userId') != userId &&
					this.chatModel.get('isOperator') == false &&
					this.chatModel.get('isWidget') == true &&
					this.chatModel.get('expanded') == false &&
					isHistory == false
				//todo: popped out
				// && this.poppedOut == false
			) {
				this.getWidgetView().flashNotification(message);
			}

			// Warn the user if they send a message whilst they are alone in the room
			if (this.isUserAlone && !this.chatModel.get('isOperator') && !isHistory && message != this.chatModel.get('Question') && !this.chatModel.get('noOperatorMessageSeen')) {
				var date = new Date();
				date.setTime(time * 1000 + 1);
				date = this.convertToUserTime(date);
				this.chatModel.get('messages').add({ date: date, type: 'note', message: _.escape(this.getResource("chat_noOperatorMessage")), resourceKey: 'chat_noOperatorMessage', isClosedChat: isClosedChat });
				this.chatModel.set('noOperatorMessageSeen', true);
			}

			// All this hokey logic makes the chats scroll from the bottom in the new dashboard when there aren't enough messages to make the container overflow
			$('body').trigger('ChatMessageAdded');
			this.flashMobileNotificationIcon();
		},
		onTyping: function (userId, userDisplayName, roomId, roomDisplayName, isTyping, time) {
			this.messageView.typing(userId, userDisplayName, isTyping);
		},
		onRoomClosed: function (roomId) {
			if (!this.options.get('isOperator') && !localStorage['roomId'] && this.getDataController().connectionInfo.get('roomId') == roomId) {
				this.onCloseChat(true);
			}
		},
		onRoomDestroyed: function (roomId, roomDisplayName, time, reasonCode) {
			this.chatModel.set('closedReasonCode', reasonCode);
			if (reasonCode == 4) {
				this.chatModel.set('state', app.Constants.WidgetStates.EmailForm);
			} else {
				this.chatModel.set('state', app.Constants.WidgetStates.Closed);
			}
		},
		onUserDestroyed: function () {
			this.chatModel.set('state', app.Constants.WidgetStates.Closed);
		},
		onRoomDetailsChanged: function (args) {
			// For now, just set the roomAvatar and the roomHostName
			this.chatModel.set({
				roomHostAvatarUrl: args.roomHostAvatarUrl || null,
				roomHostName: args.roomHostName || null,
				visitorEmail: args.visitorEmail || this.chatModel.get('visitorEmail'),
				visitorName: args.visitorName || this.chatModel.get('visitorName'),
				visitorPhoneNumber: args.visitorPhoneNumber || this.chatModel.get('visitorPhoneNumber'),
				visitorFirstName: args.visitorFirstName || this.chatModel.get('visitorFirstName'),
				visitorLastName: args.visitorLastName || this.chatModel.get('visitorLastName'),
				visitorCompany: args.visitorCompany || this.chatModel.get('visitorCompany')
			});
			this.getViewController().triggerRoomChangedForApi();
		},
		onJoined: function (userId, userDisplayName, roomId, roomDisplayName, time, isHistory, isClosedChat) {
			if (this.chatModel.get('isOperator') || userId != this.chatModel.get('userId')) {
				var date = new Date();
				date.setTime(time * 1000);
				date = this.convertToUserTime(date);
				this.chatModel.get('messages').add({
					date: date,
					type: 'note',
					important: true,
					message: htmlDecode(_.escape(this.getResource('chat_joinMessage', { displayName: $.trim(userDisplayName) }))),
					username: userDisplayName,
					resourceKey: 'chat_joinMessage',
					time: date.toHourMinuteString(),
					isClosedChat: isClosedChat
				});
			}
			//if (this.chatModel.get('isOperator') && userId == this.chatModel.get('userId')) {
			//    this.chatModel.get('messages').add({
			//        date: date,
			//        type: 'message',
			//        message: _.escape(this.getResource('chat_startedMessage')),
			//        userName: userDisplayName,
			//        myMessage: userId == this.chatModel.get('userId'),
			//        time: date.toHourMinuteString(),
			//        avatarUrl: this.settings.get('avatarUrl'),
			//        fromOperator: true,
			//        visitorAvatarUrl: this.settings.get('room') && this.settings.get('room').visitorAvatarUrl ? this.settings.get('room').visitorGravatarHash : '',
			//        rootUrl: this.chatModel.get('cdnServerUrl'),
			//        userId: userId,
			//        isClosedChat: isClosedChat
			//    });
			//}
			if (userId != this.chatModel.get('userId')) {
				this.isUserAlone = false;
				this.chatModel.get('operators').add({ userDisplayName: userDisplayName, userId: userId });
				if (this.chatModel.get('operators').length > 0) {
					if (this.chatModel.get('isOperator')) {
						//t.widget.widgetView.setTitle(userDisplayName);
					} else {
						this.getWidgetView().setTitle(htmlDecode(this.getResource('chat_nowChattingWith', { chatUserNames: this.chatModel.chatUserNames() })), 'chat_nowChattingWith');
					}
				} else {
					this.isUserAlone = true;
				}
			}
		},
		onLeft: function (userId, userDisplayName, roomId, roomDisplayName, time, isHistory, isClosedChat) {
			if (this.chatModel.get('isOperator') || userId != this.chatModel.get('userId')) {
				var date = new Date();
				date.setTime(time * 1000);
				date = this.convertToUserTime(date);
				this.chatModel.get('messages').add({
					date: date,
					type: "note",
					message: this.getResource("chat_leftMessage", { displayName: $.trim(userDisplayName) }),
					resourceKey: "chat_leftMessage",
					time: date.toHourMinuteString(),
					isClosedChat: isClosedChat
				});
			}
			if (userId != this.chatModel.get('userId')) {
				this.chatModel.get('operators').remove(userId);

				if (!this.chatModel.get('isOperator') && this.chatModel.chatUserNames().length > 0) {
					this.getWidgetView().setTitle(htmlDecode(this.getResource('chat_nowChattingWith', { chatUserNames: this.chatModel.chatUserNames() })), 'chat_nowChattingWith');
				} else {
					this.getWidgetView().setTitle(htmlDecode(this.getResource('title_initial')), 'title_initial');
				}
			}
		}
	});
	States.addInitializer(function () {
		app.commands.setHandler('roomclosed', function (roomId) {
			if (typeof _pcwi !== 'undefined') {
				_pcwi.state.triggerMethod('roomClosed', roomId);
			}
		});
	});
}, purechatApp.Models);

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {


	/*
	The state after a chat has been closed by the operator. Display a "thanks" message.
	*/
	States.PCStateClosed = States.PCWidgetState.extend({
		name: 'closed',
		stateSettings: {
			shouldBeInRoom: false,
			UiVisiblity: {
				restartButton: true,
				removeWidgetButton: true
			}
		},
		handleRoomClose: function (response, room) {
			var self = this;
			var visitorIPAddress = typeof response !== 'undefined' && response !== null && typeof response.visitorIPAddress === 'string' ? response.visitorIPAddress : '';
			var visitorIPAddressId = typeof response !== 'undefined' && response !== null && response.Id ? response.Id : -1;
			var roomName = typeof room !== 'undefined' && room !== null && typeof room.name === 'string' ? room.name : '';
			var visitorReferer = typeof room !== 'undefined' && room !== null && room.visitorReferer === 'string' ? room.visitorReferer : '';
			var roomId = typeof room !== 'undefined' && room !== null && typeof room.id !== 'undefined' ? room.id : '';
			if (self.options.get('isOperator') && room.roomType && room.roomType == PureChat.enums.roomType.visitor) {
				$.ajax({
					url: '/ExternalApps',
					type: 'GET',
					data: { chatId: self.getDataController().connectionInfo.get('roomId') }
				}).done(function (result) {
					var myel = $(self.getWidgetView().el);
					_.each(result, function (value, key) {
						myel.find('#export-' + key).toggle(value);
					});
				});
			}
			self.getWidgetView().$el.removeClass('purechat-button-hidden');
			//ensure that we are visible;
			self.getWidgetView().onShow();

			//Need to set this to false so that it will be down on the next page load.
			localStorage.expanded = false;
			self.getDataController().connectionInfo.set('chatClosed', true);
			self.getDataController().connectionInfo.persistLocalStorage();
			self.getWidgetView().setTitle(self.getResource('title_chatClosed'), 'title_chatClosed');
			var m = new backbone.Model({
				isOperator: self.chatModel.get('isOperator'),
				roomId: roomId,
				visitorIPAddress: visitorIPAddress,
				visitorIPAddressId: visitorIPAddressId,
				visitorName: roomName,
				visitorReferrer: visitorReferer,
				closedReasonCode: self.chatModel.get('closedReasonCode')
			});
			if (!self.chatModel.get('isOperator')) {
				m.set({
					GoogId: self.getWidgetSettings().get('GoogId'),
					GaTrackingTab: self.getWidgetSettings().get('GaTrackingTab'),
					GaTrackingChat: self.getWidgetSettings().get('GaTrackingChat'),
					GaTrackingThumbs: self.getWidgetSettings().get('GaTrackingThumbs'),
					GAUpThumbEvent: self.getWidgetSettings().get('GAUpThumbEvent'),
					GADownThumbEvent: self.getWidgetSettings().get('GADownThumbEvent'),
					GAEventCategory: self.getWidgetSettings().get('GAEventCategory'),
					UsingGa: self.getWidgetSettings().get('UsingGa'),
					AskForRating: self.getWidgetSettings().get('AskForRating'),
					CtaButton: self.getWidgetSettings().get('CtaButton'),
					DownloadTranscript: self.getWidgetSettings().get('DownloadTranscript')
				});
			} else {
				m.set({
					GoogId: "",
					GaTrackingTab: false,
					GaTrackingChat: false,
					GaTrackingThumbs: false,
					GAUpThumbEvent: false,
					GADownThumbEvent: false,
					GAEventCategory: false,
					UsingGa: false
				});
			}
			var closedViewParams = {
				rm: self.getResources(),
				model: m,
				settings: self.options,
				chatModel: self.chatModel
			};
			var isOperator = self.options.get('isOperator');
			this.closeMessage = !isOperator ? new app.Views.ClosedMessage(closedViewParams) : new app.Views.ClosedOperatorView(closedViewParams);
			self.listenTo(this.closeMessage, 'chat:rated', function (up) {
				self.getDataController().rateChat(up);
				if (up) {
					purechatApp.Utils.GaEvent(self.getWidgetSettings(), 'GaTrackingThumbs', 'GAUpThumbEvent');
				} else {
					purechatApp.Utils.GaEvent(self.getWidgetSettings(), 'GaTrackingThumbs', 'GADownThumbEvent');
				}
				self.getViewController().triggerResizedEvent();
				self.getViewController().trigger('chat:rate', {
					rating: up
				});
			});
			self.getWidgetView().content.show(this.closeMessage);
			if (isOperator) {
				this.closeMessage.renderMessageList();
			}
			self.getWidgetView().hideRoomHostAvatar();
			self.chatModel.set({
				roomHostAvatarUrl: null,
				roomHostName: null
			});
			if (self.options.get('isDirectAccess')) {
				$('.direct-container-header').css('display', 'block');
				if (typeof resizeDirectAccessContainer === 'function') {
					resizeDirectAccessContainer();
				}
			}
			app.execute('poweredby:update', 'Love chatting? Add <a ' + (!self.options.get('isPersonalChat') ? 'style="font-size: 10px !important;"' : '') + ' href="https://purechat.com" target="_blank">Pure Chat</a> to your site for free!');
			if (_.isFunction(self.getDataController().unbindHandlerEvents)) {
				self.getDataController().unbindHandlerEvents();
			}
			self.getViewController().trigger('chat:end',
				self.chatModel.pick([
					'visitorEmail',
					'visitorName',
					'visitorPhoneNumber',
					'visitorQuestion',
					'visitorFirstName',
					'visitorLastName',
					'visitorCompany'
				]));
		},
		onSelectionShow: function () {
			this.closeMessage.updateScroll();
		},
		onEnter: function () {
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			var self = this;
			var room = this.options.get('room') || {};
			self.getWidgetView().chatAutoStarted = false;
			if (self.options.get('isPersonalChat') && !self.getPersonalDetailsView()) {
				self.getWidgetView().$el.find('.purechat-start-chat-button-container button').html('Back to Chat<i style="margin-left: .5em;" class="fa fa-chevron-right"></i>');
				self.personalDetails = new app.Views.PersonalChatDetails({
					model: self.options
				});
				self.getWidgetView().personalDetails.show(self.personalDetails);
				self.setPersonalDetailsView(self.personalDetails);
				self.personalDetails.triggerMethod('afterInserted');
			}
			if (self.chatModel.get('isOperator')) {
				if (!isNaN(parseInt(room.id))) {
					$.ajax({
						type: 'get',
						dataType: 'json',
						url: '/api/Widgets/GetVisitorIPAddress/' + (room.id || -1)
					}).done(function (response) {
						self.handleRoomClose(response, room);
					});
				} else {
					self.handleRoomClose(null, room);
				}
			} else {
				self.handleRoomClose(null, null);
			}
		},
		onExport: function (args) {
			var data = {};
			data.chatId = this.options.get('room').id;
			data.visitorEmail = this.options.get('room').visitorEmail;
			data.visitorName = this.options.get('room').visitorName;
			pcDashboard.execute('export:' + args.app, data);
		},
		onRestartChat: function () {
			var self = this;
			var inRoom = this.getDataController().checkInRoom();
			//If the room was just closed then expanded is false, 
			//need to make sure we make it expanded again.
			localStorage.expanded = true;

			this.syncWithContact().done(function () {

				if (inRoom) {
					this.getChatModel().set('state', app.Constants.WidgetStates.Activating);
				} else {

					self.getDataController().restartChat().done(function () {
						self.getChatModel().restartChat();
						self.getViewController().resetVisitorQuestion();
						self.getViewController().trigger('widget:restart');
					}).fail(function () {
						// TODO
					});
				}

			});
		}
	});

}, purechatApp.Models);

purechatApp.module("Controllers.States", function (States, app, Backbone, Marionette, $, _, Models) {


	/*
	The state when there are no operators available
	*/
	States.PCStateUnavailable = States.PCWidgetState.extend({
		name: 'unavailable',
		stateSettings: {
			shouldBeInRoom: false
		},
		onEnter: function () {
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			var self = this;
			var behavior = this.settings.get('IPIsBanned') ? 1 : self.options.get('UnavailableBehavior');
			self.getWidgetView().$el.find('.purechat-start-chat-button-container button').html('Start Chat');
			if (behavior == 0) {
				self.getWidgetView().onHide();
			} else if (behavior == 1) {
				self.getWidgetView().onShow();
				if (self.widgetView.model.get('expanded')) {
					self.getWidgetView().setTitle(this.getResource('title_noOperators'), 'title_noOperators');
				} else {
					self.getWidgetView().setTitle(self.getResource('title_initial'), 'title_initial');
				}
				//todo chad need to create a view.
				$(self.getWidgetView().content.el).html('<div data-resourcekey="error_noOperators" class="purechat-closedmessage-container purechat-no-operators">' + app.Utils.linkify(this.getResource("error_noOperators")) + '</div>');
				if (this.options.get('isPersonalChat') && this.options.get('isInEditorMode') && window.pcPersonalEditor) {
					window.pcPersonalEditor.execute('editButton:show', $(self.getWidgetView().content.el).find('[data-resourcekey]'));
				}
			} else {
				self.getWidgetView().onShow();
				if (self.widgetView.model.get('expanded')) {
					if (self.settings.get('isPersonalChat')) {
						self.getWidgetView().setTitle(this.getResource('title_noOperators'), 'title_noOperators');
					} else {
						self.getWidgetView().setTitle(this.getResource('title_emailForm'), 'title_emailForm');
					}
				} else {
					self.getWidgetView().setTitle(self.getResource('title_initial'), 'title_initial');
				}
				//need to update to pass these in as options.
				var model = new backbone.Model({
					AskForFirstName: self.settings.get('AskForFirstName'),
					AskForLastName: self.settings.get('AskForLastName'),
					AskForEmail: true,
					AskForCompany: self.settings.get('AskForCompany'),
					AskForQuestion: true,
					AskForPhoneNumber: self.settings.get('AskForPhoneNumber'),
					EmailForm: true,
					InitialVisitorFirstName: self.getViewController().getChatModel().get('visitorFirstName') || '',
					InitialVisitorLastName: self.getViewController().getChatModel().get('visitorLastName') || '',
					InitialVisitorEmail: self.getViewController().getChatModel().get('visitorEmail') || '',
					InitialVisitorCompany: self.getViewController().getChatModel().get('visitorCompany') || '',
					InitialVisitorQuestion: self.getViewController().getChatModel().get('visitorQuestion') || '',
					InitialVisitorPhoneNumber: self.getViewController().getChatModel().get('visitorPhoneNumber') || ''
				});
				model.on("formSubmit", function (data) {
					var form = $(self.getWidgetView().el).find('.purechat-form.purechat-email-form');
					app.execute('spinner:show', form);
					self.getDataController()
						.submitEmailForm(data)
						.done(function (result) {
							if (result.success) {
								var emailSent = new purechatApp.Views.EmailSent({ rm: self.getResources(), model: model });
								self.getWidgetView().content.show(emailSent);
								self.getWidgetView().ui.restartButton.show();
								self.getWidgetView().$el.find('.btn-restart').on('click.RestartChat', function (e) {
									self.restartChat.call(self, e);
								});
								self.getViewController().trigger('email:send', data);
							} else {
								form.find('.purechat-email-error').css({
									display: 'block'
								});
							}
						})
						.fail(function () {

						}).always(function () {
							app.execute('spinner:show', form);
						});
				});

				var emailForm = new purechatApp.Views.StartChatForm({
					viewController: self.getViewController(),
					rm: self.getResources(),
					model: model,
					settings: this.options,
					FormType: 'email'
				});
				self.getWidgetView().content.show(emailForm);

			}

			self.listenTo(self.getChatModel(), "change:operatorsAvailable", function (model, available) {
				if (available) {
					self.getChatModel().set('state', app.Constants.WidgetStates.Inactive);
				}
			});

			// only poll availability if it is expanded or set to hide widget on unavailable.
			var isHideWidget = self.getWidgetSettings().get('UnavailableBehavior') == 0;
			if ((self.widgetView.model.get('expanded') && !isHideWidget) ||
			(isHideWidget && self.getChatModel().get('operatorsAvailable')) ||
			(self.options.get('enableAvailabilityPolling'))) {
				if (!window._pcDisableAvailabilityPings) {
					self.startAvailabilityPolling();
				}
			}
		},
		onExpanded: function () {
			var self = this;
			var inRoom = this.getDataController().checkInRoom();

			if (inRoom) {
				this.getChatModel().set('state', app.Constants.WidgetStates.Activating);
			} else {
				var behavior = this.settings.get('IPIsBanned') ? 1 : self.options.get('UnavailableBehavior');
				if (behavior == 1) {
					self.getWidgetView().setTitle(this.getResource('title_noOperators'), 'title_noOperators');
				} else {
					self.getWidgetView().setTitle(this.getResource('title_emailForm'), 'title_emailForm');
				}
				if (!window._pcDisableAvailabilityPings) {
					this.startAvailabilityPolling();
				}
			}
		},
		onCollapsed: function () {
			this.getWidgetView().setTitle(this.getResource('title_initial'));
			if (this.getWidgetSettings().get('UnavailableBehavior') != 0)
				this.stopAvailabilityPolling();
		},
		restartChat: function (e) {
			e.stopPropagation();
			var sender = $(e.currentTarget);
			var self = this;
			sender.off('click.RestartChat');
			self.getDataController()
				.restartChat()
				.done(function () {
					self.getChatModel().restartChat();
					self.getViewController().resetVisitorQuestion();
					self.getViewController().trigger('widget:restart');
				})
				.fail(function () {
					//todo actual implementation
					throw new Error('Failed to send email. Please try again!');
				});
		}
	});
}, purechatApp.Models);
purechatApp.module("Controllers.States", function(States, app, Backbone, Marionette, $, _, Models) {
	/*
	    This state is used exclusively for displaying a sad message to the user that he / she is using a crappy old browser
	*/
	States.PCStateUnsupported = States.PCWidgetState.extend({
		name: 'unsupported',
		stateSettings: {
			UiVisiblity: {
            
			}
		},
		onEnter: function() {
			var self = this;
			// self.getWidgetView().content.show(self.chatForm);
			States.PCWidgetState.prototype.onEnter.apply(this, arguments);
			self.getWidgetView().content.show(new app.Views.UnsupportedBrowser());
		}
	});

}, purechatApp.Models);



purechatApp.module("Controllers", function (Controllers, app, Backbone, Marionette, $, _, Models) {
	var BaseDataController = Marionette.Controller.extend({
		getCookie: function (cname) {
			var name = cname + "=";
			var ca = document.cookie.split(';');
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) == ' ') c = c.substring(1);
				if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
			}
			return "";
		},
		resetExpandedForMobile: function () {
		},
		getPreviousChat: function (chatId) {
			var d = $.Deferred();
			d.resolve([]);
			return d.promise();
		},
		getContactInfo: function () {
			var d = $.Deferred();
			var contactId = this.getCookie("_PCCID");
			var widgetId = Marionette.getOption(this, 'widgetId');
			if (contactId && widgetId) {
				$.ajax({
					url: Marionette.getOption(this, 'pureServerUrl') + '/api/contact/widget/' + Marionette.getOption(this, 'widgetId') + "/" + contactId
				}).done(function (result) { d.resolve(result); }).fail(function () {
					console.log('Error obtaining contact details');
				});
			} else {
				setTimeout(function () { d.resolve() }, 0);
			}

			return d;
		},
		initialize: function () {
			var self = this;
			this.sentChatRequest = false;
			this.connectionInfo = new purechatApp.Models.ChatConnection({}, this.options);
			if (this.options.connectionInfo) {
				this.connectionInfo.set(this.options.connectionInfo);
			}
			this._originalGetWidgetSettings = this.getWidgetSettings;
			this.getWidgetSettings = function () {
				var deferred = $.Deferred();
				self._originalGetWidgetSettings.apply(self, arguments).done(function (response) {
					if (response.widgetConfig && response.widgetConfig.AllowWidgetOnMobile && response.widgetConfig.RequestFromMobileDevice) {
						// CLEAR OUT expanded flag from local storage, because we don't want the widget to ever automatically open on the user's site
						localStorage.expanded = false;
					}
					deferred.resolve(response);
				});
				return deferred.promise();
			};
		},
		unbindHandlerEvents: function () {

		},
		loadWidgetSettings: function () {
			var self = this;
			var d = $.Deferred();
			this.getWidgetSettings()
				.done(function (settings) {
					self.widgetSettings = settings;
					d.resolve();
				})
				.fail(function () {
					d.reject();
				});
			return d;
		}
	});

	var TestDataController = BaseDataController.extend({
		initialize: function () {
			BaseDataController.prototype.initialize.apply(this, arguments);
			this.chatAvailable = typeof this.setDemoUnavailable === 'function' ? !this.setDemoUnavailable() : true;
		},
		startChat: function (data) {
			this.connectionInfo.set('userId', 1);
			this.connectionInfo.set('authToken', "adsfasfdsdf");
			this.connectionInfo.set('roomId', 1);
			return $.Deferred().resolve(this.connectionInfo);
		},
		closeChat: function (data) {
			return $.Deferred().resolve();
		},
		getContactInfo: function () {
			var d = $.Deferred();
			setTimeout(function () { d.resolve({ "firstName": "", "lastName": "", "company": "", "email": "", "phone": "" }); }, 0);
			return d;
		},
		restartChat: function (data) {
			return $.Deferred().resolve();
		},
		connectToChatServer: function (handler) {
			var d = $.Deferred();
			this.handler = handler;
			setTimeout(function () {
				d.resolve();
			}, 0);
			return d;
		},
		sendRoomHistory: function (roomId) {
			//Do Nothing for now
		},
		checkInRoom: function () {
			return false;
		},
		newMessage: function (message) {
			var self = this;
			var now = new Date();
			var hours = now.getHours();
			var minutes = now.getMinutes();
			var seconds = now.getSeconds();
			var pm = hours >= 12;
			hours = hours < 10 ? hours : (hours == 12 ? hours : hours % 12);
			minutes = minutes < 10 ? '0' + minutes : minutes;
			seconds = seconds < 10 ? '0' + seconds : seconds;
			Marionette.getOption(this, 'chatModel').get('messages').add({
				userId: now.getTime(),
				type: "message",
				message: message,
				myMessage: true,
				userName: 'Aaron',
				time: hours + ':' + minutes + ' ' + seconds + (pm ? 'PM' : 'AM'),
				date: now,
				avatarUrl: '/content/images/avatars/visitor.png'
			});
		},
		checkChatAvailable: function (accountId) {
			var self = this;
			var d = $.Deferred();
			setTimeout(function () {
				d.resolve({ available: self.chatAvailable });
			}, 1);
			return d;
		},
		getWidgetSettings: function () {
			var widgetSettings = {
				"Version": 27288,
				"WidgetWording": { "Id": 721, "AccountId": 0, "Title": "Chat with us test." },
				"AccountId": 1,
				"Color": "000000",
				"Position": 2,
				"WidgetType": 1,
				"UnavailableBehavior": 2,
				"AskForRating": true,
				"AskForFirstName": true,
				"AskForLastName": true,
				"AskForEmail": false,
				"AskForCompany": true,
				"AskForQuestion": true,
				"ForcePopout": false,
				"StringResources": { "chat_identifyFailed": "Failed to connect to PureChat!", "greeting": "Hello", "closed_message": "Thanks for chatting. Please rate how you feel about the chat session:", "closed_opMessage": "This chat has ended.<br/>What would you like to do?", "chat_joinMessage": "{displayName} has joined the chat!", "placeholder_email": "Email", "chat_connecting": "Connecting you to the chat now...", "chat_nowChattingWith": "Chatting with {chatUserNames}.", "label_pressToBegin": "Press the button below to begin!", "error_enterEmail": "Please enter an email address.", "closed_downloadTrans": "Download chat transcript", "title_noOperators": "No Operators Available", "error_enterQuestion": "Please enter a question", "noOperators_email_message": "There are currently no operators available, but feel free to send us an email!", "poweredby": "Powered by", "chat_noOperatorMessage": "An operator has not yet connected. Don\u0027t worry, an operator will be by shortly! When they connect, they\u0027ll see all the messages you\u0027ve sent so far.", "chat_typing": "{displayName} is typing", "title_chatClosed": "Chat Closed", "closed_ratingThanks": "Thanks for your rating!", "placeholder_name": "Name", "placeholder_firstName": "First Name", "placeholder_lastName": "Last Name", "placeholder_comapny": "Company", "title_initial": "Chat with us test.", "placeholder_question": "Enter your Question", "label_initial_label": "Introductory Text", "title_initial_label": "Widget Title", "error_noOperators": "Sorry, no operators are currently available", "label_initial": "Enter your info below to begin.", "error_noOperators_label": "No Operators Available", "button_startChat": "Send Chat Request", "label_initial_helptext": "This is the introductory text that will be displayed after the user clicks on the PureChat widget.", "button_sendEmail": "Send Email", "chat_startedMessage": "An operator will be right with you! Feel free to hide this box and navigate around the site.", "chat_leftMessage": "{displayName} has left the chat!", "chat_connectionFailed": "Failed to connect to PureChat!", "button_startNewChat": "Start a new chat", "error_noOperators_helptext": "This is the message that will be displayed when Hide Widget When Unavailable is unchecked, and there are no operators available.", "error_enterName": "Please enter a name." },
				"GoogId": "UA-XXXX-Y",
				"GaTrackingTab": false,
				"GaTrackingChat": false,
				"GaTrackingThumbs": false,
				"GATabEvent": "Tab Opened",
				"GAChatEvent": "Chat Started",
				"GAUpThumbEvent": "Thumbs Up",
				"GADownThumbEvent": "Thumbs Down",
				"GAEventCategory": "PureChat widget",
				"UsingGa": false,
				"ChatServerUrl": "http://chad.purechat.com:8000",
				"DisplayWidgetAnimation": "bounceInDown",
				"CollapsedWidgetImageUrl": "http://chad.purechat.com/Content/images/widgetSamples/operator1.png"
			};

			return $.Deferred().resolve(widgetSettings);
		},
		rateChat: function (rate) {
			var d = $.Deferred();

			return d.resolve();
		},
		setTypingIndicator: function (isTyping) {
			//donothing when testing.
		},
		bindEvents: function (handler) {
			this.handler = handler;
		}
	});


	var DemoDataController = TestDataController.extend({
		getWidgetSettings: function () {
			var d = $.Deferred();
			if (window.parent && window.parent.currentWidgetSettings) {
				//window.parent.currentWidgetSettings.set('ForcePopout', false);
				d.resolve(window.parent.currentWidgetSettings.attributes);
			} else if (this.options.isPersonalChat && window.pcPersonalEditorSettings) {
				// Need to reset the datacontroller and renderinto
				window.pcPersonalEditorSettings.set({
					'dataController': window.pcDataController,
					'renderInto': window.pcRenderInto
				});
				d.resolve(window.pcPersonalEditorSettings.attributes);
			} else {
				$.ajax({
					url: Marionette.getOption(this, 'pureServerUrl') +
						'/VisitorWidget/Widget/' +
						Marionette.getOption(this, 'widgetId') + window.location.search,
					dataType: 'jsonp',
					timeout: 20000,
					success: function (response) {
						// we got the widget info ok - render the widget and advance to the next state
						response.UserWidgetSettings = new Backbone.Model(response.UserWidgetSettings);
						var widgetSettings = {
							success: true,
							version: response.Version,
							accountId: response.AccountId,
							color: response.Color,
							position: response.Position,
							widgetType: response.WidgetType,
							widgetConfig: response,
							resources: response.StringResources,
							googleAnalytics: response.GoogleAnalytics,
							chatServerUrl: response.ChatServerUrl,
							ShowMinimizeWidgetButton: response.ShowMinimizeWidgetButton,
							userWidgetConfig: response.UserWidgetSettings
						};
						d.resolve(widgetSettings);
					},
					error: function (xhr, textStatus, error) {
						d.reject();
					}
				});
			}
			return d.promise();
		},
		isDemo: function () {
			return Marionette.getOption(this, 'isDemo');
		},
		setDemoUnavailable: function () {
			return Marionette.getOption(this, 'setOperatorsUnavailable');
		}
	});

	var PCDataController = BaseDataController.extend({
		sessionTimeout: 1000 * 60 * 20, // 20 minutes

		timeStampUrl: function (url) {
			var now = new Date();
			if (url.indexOf('?') >= 0) {
				// Query string exists, so append timestamp to end
				return url + '&t=' + now.getTime();
			} else {
				return url + '?t=' + now.getTime();
			}
		},
		closeChat: function (args) {
			this.chatServerConnection.destroyself(null, args);
			return $.Deferred().resolve();
		},
		leaveChat: function () {
			this.chatServerConnection.leave(this.connectionInfo.get('roomId'));
			return $.Deferred().resolve();
		},
		restartChat: function (data) {
			this.connectionInfo.clearLocalStorage();
			return $.Deferred().resolve();
		},
		newMessage: function (message) {
			if ($.trim(message) == '') {
				return false;
			}
			if ($.trim(message) == '') return false;
			this.chatServerConnection.sendmessage(message, this.connectionInfo.get('roomId'));
		},
		checkChatAvailable: function (accountId) {
			var self = this;
			accountId = accountId || this.widgetSettings.accountId;
			var badBrowser = false;

			if (this.options.BrowserDetails) {
				var browserVersion = this.options.BrowserDetails.Version;
				var parsedBrowserVersion = parseInt(browserVersion);

				if ((this.options.BrowserDetails.Browser == 'Opera'
						&& parsedBrowserVersion < 12)
					|| (this.options.BrowserDetails.Browser.replace(/\s+/g, '') == 'InternetExplorer'
						&& parsedBrowserVersion <= 9)
					|| (this.options.BrowserDetails.Browser == 'Safari'
						&& parsedBrowserVersion < 5
						&& parsedBrowserVersion > 0)) {
					badBrowser = true;
				}
			}

			if (!window._checkChatAvailableDeferred) {
				window._checkChatAvailableDeferred = $.Deferred();
				if (!badBrowser) {
					var urlOptions = {
						accountId: accountId,
						widgetId: this.options ?
							this.options.connectionSettings &&
							this.options.connectionSettings.c ?
							this.options.connectionSettings.c :
							this.options.widgetId || this.options.Id
							: null
					};
					var url = Marionette.getOption(this, 'pureServerUrl') + '/VisitorWidget/ChatAvailable/' +
						urlOptions.accountId +
						'/' + urlOptions.widgetId +
						'/_PCcb?externalRequest=false';
					$.ajax({
						// This is really stupid, but if it works, then I guess ios devices need SUPER cachebusting urls :/
						url: self.timeStampUrl(url),
						dataType: 'jsonp',
						timeout: 20000,
						jsonpCallback: '_PCcb',
						error: function () {
							window._checkChatAvailableDeferred.reject();
							window._checkChatAvailableDeferred = null;
						}
					});
				} else {
					setTimeout(function () {
						window._checkChatAvailableDeferred.resolve({ a: 0, r: 2 });
					}, 300);
				}
			}
			return window._checkChatAvailableDeferred.promise();
		},
		getWidgetSettings: function () {
			var self = this;
			var hasAllSettings = typeof Marionette.getOption(this, 'hasAllSettings') === 'boolean' ? Marionette.getOption(this, 'hasAllSettings') : false;
			var d = $.Deferred();
			if (!hasAllSettings) {
				$.ajax({
					url: Marionette.getOption(this, 'pureServerUrl') +
						'/VisitorWidget/Widget/' +
						Marionette.getOption(this, 'widgetId'),
					dataType: 'jsonp',
					timeout: 20000,
					success: function (response) {
						if (response.Valid) {
							//We don't want the hide widget behavior if its a hosted page.
							if (response.UnavailableBehavior == 0 && self.options.isDirectAccess) {
								response.UnavailableBehavior = 1;
							}
							response.UserWidgetSettings = new Backbone.Model(response.UserWidgetSettings);

							// we got the widget info ok - render the widget and advance to the next state
							var widgetSettings = {
								success: true,
								version: response.Version,
								accountId: response.AccountId,
								color: response.Color,
								position: response.Position,
								widgetType: response.WidgetType,
								widgetConfig: response,
								resources: response.StringResources,
								googleAnalytics: response.GoogleAnalytics,
								chatServerUrl: response.ChatServerUrl,
								userWidgetConfig: response.UserWidgetSettings
							};
							d.resolve(widgetSettings);
						}
					},
					error: function (xhr, textStatus, error) {
						//todo error code;
						d.reject();
					}
				});
			} else {
				d.resolve({
					success: true,
					version: Marionette.getOption(this, 'Version'),
					accountId: Marionette.getOption(this, 'AccountId'),
					color: Marionette.getOption(this, 'Color'),
					position: Marionette.getOption(this, 'Position'),
					widgetType: Marionette.getOption(this, 'WidgetType'),
					widgetConfig: this.options,
					resources: Marionette.getOption(this, 'StringResources'),
					googleAnalytics: Marionette.getOption(this, 'GoogleAnalytics'),
					chatServerUrl: Marionette.getOption(this, 'ChatServerUrl'),
					userWidgetConfig: Marionette.getOption(this, 'UserWidgetSettings')
				});
			}
			return d.promise();
		},
		submitEmailForm: function (data) {
			var i;
			var s = null;

			try {
				i = this.cleanNulls(localStorage.getItem("i"));
				if (this.isActiveSession()) {
					s = this.cleanNulls(localStorage.getItem(this.getSessionItemName()));
				}
			} catch (e) {
			}

			data.widgetId = Marionette.getOption(this, 'widgetId');
			data.startPage = data.origin || window.location.toString() || 'unknown';
			data.acquisitionSource = (localStorage.acquisitionSource || 'Direct');
			data.pccId = i;
			data.pccsId = s;

			var d = $.Deferred();
			$.ajax({
				url: Marionette.getOption(this, 'pureServerUrl') + '/VisitorWidget/SendEmail',
				dataType: 'jsonp',
				type: 'GET',
				data: data
			}).done(function (result) {
				try {
					if (response.customerId) {
						localStorage.setItem("i", response.customerId);
					}
				} catch (e) {
					//do nothing?
				}

				d.resolve(result);
			}).fail(function () {
				//todo
			});
			return d.promise();
		},
		cleanNulls: function (val) {
			//there was a bug out there for awhile and some of the ids where set to null
			//so lets clean.
			return val == 'null' ? undefined : val == null ? undefined : val;
		},
		getSessionItemName: function () {
			return "s_" + this.widgetSettings.accountId;
		},
		getLastCheckinItemName: function () {
			return "lastCheckin_" + this.widgetSettings.accountId;
		},
		isActiveSession: function () {
			var lastCheckin;
			var now = Date.now();
			var lastCheckinItemName = this.getLastCheckinItemName();

			lastCheckin = this.cleanNulls(localStorage.getItem(this.getLastCheckinItemName()));

			if (lastCheckin && (now - lastCheckin) >= this.sessionTimeout) {
				return false;
			}

			return true;
		},
		startChat: function (data) {
			var self = this;
			var d = $.Deferred();

			var i;
			var s = null;

			try {
				i = this.cleanNulls(localStorage.getItem("i"));
				if (this.isActiveSession()) {
					s = this.cleanNulls(localStorage.getItem(this.getSessionItemName()));
				}
			} catch (e) {
			}

			// Escape the user's display name so that their xss attempts won't affect themselves and
			// so that the Pure Serer won't get mad over a "potentially dangerous querystring value" if they include
			// a bracket or something
			var escapedUserDisplayName = data.visitorName;
			var escapedUserDisplayFirstName = data.visitorFirstName;
			var escapedUserDisplayLastName = data.visitorLastName;
			var escapedUserDisplayCompany = data.visitorCompany;
			var url = Marionette.getOption(this, 'pureServerUrl') + '/VisitorWidget/Chat/'
				+ Marionette.getOption(this, "widgetId") +
				'?visitorName=' + encodeURIComponent(escapedUserDisplayName || '') +
				'&visitorFirstName=' + encodeURIComponent(escapedUserDisplayFirstName || '') +
				'&visitorLastName=' + encodeURIComponent(escapedUserDisplayLastName || '') +
				'&visitorCompany=' + encodeURIComponent(escapedUserDisplayCompany || '') +
				'&origin=' + encodeURIComponent(data.origin || window.location.toString() || 'unknown') +
				'&expandSource=' + (window.localStorage.getItem('expandSource') || '') +
				'&acquisitionSource=' + (localStorage.acquisitionSource || 'Direct') +
				'&operatorJoinIds=' + (encodeURIComponent((data.operatorJoinIds || []).join(','))) +
				'&initiator=' + encodeURIComponent(data.initiator || '') +
				'&startedByOperator=' + ((data.startedByOperator || false).toString()) +
				'&pccid=' + i +
				'&pccsid=' + s + 
				'&sentChatRequest=' + ((this.sentChatRequest || false).toString());

			if (data.visitorEmail) {
				url += '&visitorEmail=' + encodeURIComponent(data.visitorEmail);
			}
			if (data.visitorPhoneNumber) {
				url += '&visitorPhoneNumber=' + encodeURIComponent(data.visitorPhoneNumber);
			}
			if (data.visitorQuestion && data.initiator != 1) {//shouldn't send question if started by operator.  
				url += '&visitorQuestion=' + encodeURIComponent(data.visitorQuestion);
			}
			if (!this.sentChatRequest) {
				this.sentChatRequest = true;
			}

			$.ajax({
				url: url,
				dataType: 'jsonp',
				timeout: 20000,
				success: function (response) {
					if (response.user && response.room) {
						
						try {
							if (response.customerId) {
								localStorage.setItem("i", response.customerId);
							}
						} catch (e) {
							//do nothing?
						}

						self.connectionInfo.set({
							userId: response.user.id,
							authToken: response.user.authToken,
							roomId: response.room.id,
							chatId: response.chat.id,
							chatClosed: false
						});
						//Update the chatserverurl.  This might not have been set on initial load
						//if this account hasn't been give a server yet.
						self.widgetSettings.chatServerUrl = response.server.url;
						d.resolve(self.connectionInfo);
					} else {
						if (typeof connectingView !== 'undefined' && connectingView !== null) {
							connectingView.showErrorMessage(response.message);
						}
						d.reject(response.message);
					}

					d.resolve();
				},
				error: function (xhr, textStatus, error) {

					d.reject(textStatus + ", " + error);
					//todo;
					//connectingView.showErrorMessage('<strong>' + self.getResource('chat_connectionFailed') + '</strong>');
				},
				complete: function () {
					//Use setTimeout to let all of the listeners in the event loop run 
					//prior to removing this flag
					setTimeout(function () { self.sentChatRequest = false; }, 0);
				}
			});
			return d;
		},
		connectToChatServer: function (bindTo) {
			var t = this;
			var d = $.Deferred();


			var accountId = accountId || this.widgetSettings.accountId;

			var socketConnected;

			// Connect to the chat server with the credentials we recieved from the web server

			function onIdentify(success, response, errorCode, errorMessage) {
				socketConnected = true;
				if (success == false) {
					d.reject();
				} else {
					// Now switch to the chatting state
					d.resolve();
				}
			}

			// socket IO will not reconnect after a successful connect (e.g., when we connect, then use bad identify creds from a cookie, then try to reconnect)
			// so we have to keep the old connection and just identify instead of trying to reconnect
			if (!this.chatServerConnection) {
				this.chatServerConnection = new PureChat(this.widgetSettings.chatServerUrl + '/client', this.connectionInfo.get('userId'), accountId, this.connectionInfo.get('authToken'), onIdentify, function () {
					if (!socketConnected) {
						d.reject();
					}
				},
					null,
					(typeof this.options.connectionSettings.poppedOut === 'boolean' ? this.options.connectionSettings.poppedOut : false));
				if (bindTo) {
					this.bindEvents(bindTo);
				}
			} else {
				this.chatServerConnection.identify(this.connectionInfo.get('userId'), accountId, this.connectionInfo.get('authToken'), onIdentify, (typeof this.options.connectionSettings.poppedOut === 'boolean' ? this.options.connectionSettings.poppedOut : false));
				if (bindTo) {
					this.bindEvents(bindTo);
				}
			}
			return d;
		},

		setTypingIndicator: function (isTyping) {
			this.chatServerConnection.sendtyping(this.connectionInfo.get('roomId'), isTyping);
		},
		rateChat: function (rate) {
			var d = $.Deferred();

			$.ajax({
				url: Marionette.getOption(this, 'pureServerUrl') + '/VisitorWidget/Rate',
				dataType: 'jsonp',
				data: {
					chatId: this.connectionInfo.get('chatId'),
					rating: rate,
					authToken: this.connectionInfo.get('authToken')
				}
			})
				.done(function () {

				})
				.fail(function () {

				});

			return d.promise();
		},
		checkInRoom: function () {
			return this.connectionInfo.isInChat() ||
				this.connectionInfo
				.loadFromLocalStorage()
				.isInChat();
		},
		setCurrentPage: function (page) {
			this.chatServerConnection.setVisitorDetails(this.connectionInfo.get('roomId'), { visitorReferer: page });
		},
		sendRoomHistory: function (roomId) {
			this.chatServerConnection.sendroomhistory(roomId || this.connectionInfo.get('roomId'));
		},
		unbindHandlerEvents: function () {
			BaseDataController.prototype.unbindHandlerEvents.apply(this, arguments);

			if (this.unbindHandlerEventsImpl) {
				this.unbindHandlerEventsImpl();
			}

		},
		bindEvents: function (handler) {
			var self = this;
			self.handler = handler;
			var eventHandlers = {
				'message': function (userId, userDisplayName, roomId, roomDisplayName, time, message, isHistory, protocolVersion) {
					if (self.connectionInfo.get('roomId') == roomId) {
						message = message.replace("response below to see hos it works", "response below to see how it works");
						handler.onMessage.apply(handler, arguments);
					}
				},
				'joined': function (userId, userDisplayName, roomId, roomDisplayName, time, isHistory) {
					if (self.connectionInfo.get('roomId') == roomId) {
						handler.onJoined.apply(handler, arguments);
					}
				},
				'left': function (userId, userDisplayName, roomId, roomDisplayName, time, isHistory) {
					if (self.connectionInfo.get('roomId') == roomId) {
						handler.onLeft.apply(handler, arguments);
					}
				},
				'roomdestroyed': function (roomId, roomDisplayName, time) {
					if (self.connectionInfo.get('roomId') == roomId) {
						handler.onRoomDestroyed.apply(handler, arguments);
					}
				},
				'typing': function (userId, userDisplayName, roomId, roomDisplayName, isTyping, time) {
					if (self.connectionInfo.get('userId') == userId) return;
					if (self.connectionInfo.get('roomId') != roomId) return;
					handler.onTyping.apply(handler, arguments);
				},
				'userDestroyed': function (userId) {
					if (self.connectionInfo.get('userId') != userId) return;
					handler.onRoomDestroyed.apply(handler);
				},
				'roomdetailschanged': function (args) {
					if (self.connectionInfo.get('roomId') == args.id) {
						handler.onRoomDetailsChanged.apply(handler, arguments);
					}
				},
				'roomchanged': function (args) {
					if (self.connectionInfo.get('roomId') == args.room.id) {
						handler.onRoomChanged.apply(handler, arguments);
					}
				},
				'noOperatorJoined': function (args) {
					if (self.connectionInfo.get('roomId') == args.roomId) {
						handler.onNoOperatorJoined.apply(handler, arguments);
					}
				}
			};

			self.unbindHandlerEventsImpl = function () {
				self.chatServerConnection.off(eventHandlers);
				self.handler = null;
			};


			self.chatServerConnection.on(eventHandlers);
		}

	});


	var DashboardDataController = PCDataController.extend({
		initialize: function (options) {
			BaseDataController.prototype.initialize.apply(this, arguments);
			this.chatServerConnection = options.chatServerConnection;
		},
		closeChat: function () {
			this.chatServerConnection.closeroom(this.connectionInfo.get('roomId'));
			this.sentChatRequest = false;
			return $.Deferred().resolve();
		},
		connectToChatServer: function (bindTo) {
			var d = $.Deferred();
			//dashboard is managing this.
			if (bindTo) {
				this.bindEvents(bindTo);
			}
			return d.resolve();
		},

		htmlEncode: function (value) {
			return $('<div/>').text(value).html();
		},
		getPreviousChat: function (options) {
			var d = $.Deferred();
			var self = this;

			options = _.defaults(options, { includeMessages: true, previousCount: 1 });

			$.ajax({
				url: "/api/transcripts/related/" + options.chatId,
				dataType: 'json',
				data: options,
				type: 'get',
				success: function (data) {
					data.forEach(function (nextChat) {
						nextChat.Records.forEach(function (next) {
							next.Message = self.htmlEncode(next.Message);
						});
					})
					d.resolve(data);
				},
				error: function () {
					d.resolve(null);
				}
			});

			return d.promise();
		},
		getWidgetSettings: function () {
			var d = $.Deferred();

			$.ajax({
				url: '/User/DashboardSettings',
				dataType: 'json',
				type: 'post',
				success: function (data) {
					var widgetSettings = {
						success: true,
						authToken: data.authToken,
						version: "",
						accountId: data.accountId,
						userId: data.userId,
						position: null,
						widgetType: null,
						widgetConfig: data,
						resources: {},
						googleAnalytics: null,
						chatServerUrl: data.chatServerUrl
					};
					d.resolve(widgetSettings);

				}
			});

			return d.promise();
		},
		checkInRoom: function () {
			if (this.connectionInfo.get('roomId')) {
				return true;
			}
			return false;
		}
	});


	Controllers.DemoDataController = DemoDataController;
	Controllers.DashboardDataController = DashboardDataController;
	Controllers.PCDataController = PCDataController;


}, purechatApp.Models);
purechatApp.module("Controllers", function(Controllers, app, Backbone, Marionette, $, _, Models) {
	// Extends from the base view controller in ViewController.js
	Controllers.PureChatApiController = Marionette.Controller.extend({
		_publicApi: null,
		changeableRoomDetails: ['visitorName', 'visitorFirstName', 'visitorLastName', 'visitorEmail', 'visitorReferer', 'visitorPhoneNumber', 'additionalDetails'],
		getPublicApi: function() {
			return this._publicApi;
		},
		getBaseApiEventObject: function() {
			return {
				chatboxId: this.options.get('Id')
			};
		},
		extendBaseApiEventObject: function(obj) {
			return $.extend(this.getBaseApiEventObject(), obj || {});
		},
		bindWidgetLayoutPublicApiEvents: function() {
			var self = this;
			self.widgetLayout.on("widget:resized", function(e) {
				self.getPublicApi().trigger("resized", { widgetId: self.getChatModel().id });
				self.getPublicApi().trigger("chatbox:resize", self.extendBaseApiEventObject({ width: e.width, height: e.height }));
			});
			self.widgetLayout.on("expanded", function() {
				self.getPublicApi().trigger("chatbox:expand", self.extendBaseApiEventObject());
			});
			self.widgetLayout.on("collapsed", function() {
				self.getPublicApi().trigger("chatbox:collapse", self.extendBaseApiEventObject());
			});
			self.widgetLayout.on('minimized', function() {
				self.getPublicApi().trigger('chatbox:minimize', self.extendBaseApiEventObject());
			});
		},
		bindOptionsPublicApiEvents: function() {
			var self = this;
			self.options.on('change:Position', function() {
				self.widgetLayout.repositionWidget();
			});
		},
		bindChatModelPublicApiEvents: function() {
			var self = this;
			self.getChatModel().on('widget:available widget:unavailable', function() {
				self.getPublicApi().trigger('chatbox.available:change', self.extendBaseApiEventObject({
					available: self.getChatModel().get('operatorsAvailable')
				}));
			});
			self.getChatModel().on('operator:join', function(operator) {
				self.getPublicApi().trigger('chat:operatorJoin', self.extendBaseApiEventObject({
					operatorName: operator.get('userDisplayName')
				}));
			});
			self.getChatModel().on('operator:leave', function(operator) {
				self.getPublicApi().trigger('chat:operatorLeave', self.extendBaseApiEventObject({
					operatorName: operator.get('userDisplayName')
				}));
			});
			self.getChatModel().on('change:visitorName', function(model, newVal) {
			});
			self.getChatModel().on('change:visitorFirstName', function(model, newVal) {
				self.getPublicApi().trigger('visitor.firstName:change', self.extendBaseApiEventObject({
					firstName: newVal
				}));

				self.getPublicApi().trigger('visitor.name:change', self.extendBaseApiEventObject({
					name: model.getFullName()
				}));
			});
			self.getChatModel().on('change:visitorLastName', function(model, newVal) {
				self.getPublicApi().trigger('visitor.lastName:change', self.extendBaseApiEventObject({
					lastName: newVal
				}));

				self.getPublicApi().trigger('visitor.name:change', self.extendBaseApiEventObject({
					name: model.getFullName()
				}));
			});
			self.getChatModel().on('change:visitorCompany', function(model, newVal) {
				self.getPublicApi().trigger('visitor.company:change', self.extendBaseApiEventObject({
					company: newVal
				}));
			});
			self.getChatModel().on('change:visitorEmail', function(model, newVal) {
				self.getPublicApi().trigger('visitor.email:change', self.extendBaseApiEventObject({
					email: newVal
				}));
			});
			self.getChatModel().on('change:visitorPhoneNumber', function(model, newVal) {
				self.getPublicApi().trigger('visitor.phoneNumber:change', self.extendBaseApiEventObject({
					phoneNumber: newVal
				}));
			});
			self.getChatModel().on('change:visitorQuestion', function(model, newVal) {
				self.getPublicApi().trigger('visitor.question:change', self.extendBaseApiEventObject({
					question: newVal
				}));
			});
			self.getChatModel().on('chat:restart', function() {
				self.getPublicApi().trigger('chatbox:restart', self.extendBaseApiEventObject());
			});
		},
		bindViewControllerPublicApiEvents: function() {
			var self = this;
			this.on('chat:start', function(details) {
				self.getPublicApi().trigger('chat:start', self.extendBaseApiEventObject(self.getPublicApi().reverseMapVisitorDetails(details)));
			});
			this.on('chat:end', function(details) {
				self.getPublicApi().trigger('chat:end', self.extendBaseApiEventObject(self.getPublicApi().reverseMapVisitorDetails(details)));
			});
			this.on('chat:rate', function(details) {
				self.getPublicApi().trigger('chat:rate', self.extendBaseApiEventObject(details));
			});
			this.on('widget:poppedOut', function() {
				self.getPublicApi().trigger('chatbox:poppedOut', self.extendBaseApiEventObject());
			});
			this.on('email:send', function(details) {
				self.getPublicApi().trigger('email:send', self.extendBaseApiEventObject(self.getPublicApi().reverseMapVisitorDetails(details)));
			});
		},
		registerPublicApiEvents: function() {
			var self = this;
			if (!this._publicApi) {
				// If the public API hasn't been initialized, let's new it up and pass a pointer of the widgetSettings to it
				this._publicApi = new app.Api.Models.ApiModel();
				this._publicApi.setViewController(this);
			}
			self.on("state:changed", function(e) {
				var newEvent = { widgetId: self.getChatModel().id, state: e.newState.name };
				if (e.oldState) {
					newEvent.previousState = e.oldState.name;
				}
				self.getPublicApi().trigger("widget:state-changed", self.extendBaseApiEventObject(newEvent));
				self.getPublicApi().trigger("chatbox:state-changed", self.extendBaseApiEventObject(newEvent));
			});

			this.on("widget:ready", function() {
				// Wire up all events that require the widget to be ready first
				self.bindWidgetLayoutPublicApiEvents();
				self.bindOptionsPublicApiEvents();
				self.bindChatModelPublicApiEvents();

				try {
					// Emit outward after all initial events are wired up
					self.getPublicApi().trigger("ready", self.extendBaseApiEventObject());
				} catch (e) {
					console.error(e);
				}

				try {
					self.getPublicApi().trigger("chatbox:ready", self.extendBaseApiEventObject());
				} catch (e) {
					console.error(e);
				}
			});
			// Wire up all events that only need the view controller to be present
			this.bindViewControllerPublicApiEvents();
		},
		apiRoomDetailsChanged: function(model, propName, newValue) {
			if (this.getDataController().chatServerConnection) {
				this.getDataController()
					.chatServerConnection
					.setVisitorDetails(this.getDataController().connectionInfo.get('chatId'), model.pick(this.changeableRoomDetails));
			}
		},
		triggerRoomChangedForApi: function() {
			this.getPublicApi().trigger('chat:change', this.extendBaseApiEventObject(this.getPublicApi().reverseMapVisitorDetails(this.getChatModel().pick(this.changeableRoomDetails))));
		}
	});
});
purechatApp.module('Api.Models', function (Models, App, Backbone, Marionette, $, _) {

	// This model is going to act as a proxy to all the internal widget settings models
	Models.ApiModel = Backbone.Model.extend({
		viewController: null,
		widgetSettings: function () {
			return this.viewController ? this.viewController.options : null;
		},
		chatModel: function () {
			return this.viewController ? this.viewController.getChatModel() : null;
		},
		dataController: function () {
			return this.viewController ? this.viewController.getDataController() : null;
		},
		setWidgetSetting: function (key, val) {
			this.widgetSettings().set(key, val);
		},
		setChatModel: function (key, val) {
			this.chatModel().set(key, val);
		},
		getWidgetSetting: function (key, val) {
			this.widgetSettings().get(key);
		},
		getChatModel: function (key) {
			this.chatModel().get(key);
		},
		regexs: {
			propAccess: {
				chatBox: /^chatbox\./i,
				strings: /^string\./i,
				visitor: /^visitor\./i
			},
			events: {
				chatBox: /^chatbox:/i,
				chatBoxPropChange: /^chatbox\.\w(\w|\d)*:/i,
				chat: /^chat:/i,
				email: /^email:/i,
				visitor: /^visitor\.\w(\w|\d)*/i
			}
		},
		mappings: {
			chatBox: {
				keys: {
					available: 'available',
					position: 'Position',
					layoutType: 'CollapsedStyle',
					unavailableBehavior: 'UnavailableBehavior',
					askForRating: 'AskForRating',
					askForFirstName: 'AskForFirstName',
					askForLastName: 'AskForLastName',
					askForEmail: 'AskForEmail',
					askForCompany: 'AskForCompany',
					askForQuestion: 'AskForQuestion',
					askForPhoneNumber: 'AskForPhoneNumber',
					unavailableAskForPhone: 'UnavailableAskForPhone',
					enableTranscriptDownload: 'DownloadTranscript',
					forcePopout: 'ForcePopout',
					enableGoogleAnalytics: 'UsingGa',
					loadingAnimation: 'DisplayWidgetAnimation',
					availableImageXOffset: 'AvailableImageXOffset',
					availableImageYOffset: 'AvailableImageYOffset',
					availableImageScale: 'AvailableImageScale',
					availableImageOnTop: 'AvailableImageTop',
					availableCollapsedImageUrl: 'AvailableCollapsedWidgetImageUrl',
					availableImageHeight: 'AvailableImageHeight',
					availableImageWidth: 'AvailableImageWidth',
					useAvailableImageForBoth: 'UseAvailableImageForBoth',
					unavailableImageXOffset: 'UnavailableImageXOffset',
					unavailableImageYOffset: 'UnavailableImageYOffset',
					unavailableImageScale: 'UnavailableImageScale',
					unavailableImageOnTop: 'UnavailableImageTop',
					unavailableCollapsedImageUrl: 'UnavailableCollapsedWidgetImageUrl',
					unavailableImageHeight: 'UnavailableImageHeight',
					unavailableImageWidth: 'UnavailableImageWidth',
					showMinimizeButton: 'ShowMinimizeWidgetButton',
					expanded: {
						propertyName: 'expanded',
						setter: function (key, value, options) {
							options = options || {};
							if (value) {
								this.viewController.widgetLayout.expand(false, false, { expandSource: options.expandSource });
							} else {
								this.viewController.widgetLayout.onCollapse(false);
							}
						}
					},
					initialState: 'initialState',
					currentState: 'state',
					enableAvailabilityPolling: 'enableAvailabilityPolling'
				},
				values: {
					position: {
						bottomLeft: 1,
						bottomRight: 2,
						topLeft: 3,
						topRight: 4
					},
					layoutType: {
						tab: 1,
						button: 2,
						image: 3,
						tabWithImage: 4
					},
					unavailableBehavior: {
						hide: 0,
						message: 1,
						email: 2
					},
					loadingAnimation: {
						none: 'none',
						flipInX: 'flipInX',
						flipInY: 'flipInY',
						fadeIn: 'fadeIn',
						fadeInUp: 'fadeInUp',
						fadeInDown: 'fadeInDown',
						fadeInLeft: 'fadeInLeft',
						fadeInRight: 'fadeInRight',
						fadeInUpBig: 'fadeInUpBig',
						fadeInDownBig: 'fadeInDownBig',
						fadeInLeftBig: 'fadeInLeftBig',
						fadeInRightBig: 'fadeInRightBig',
						slideInUp: 'slideInUp',
						slideInDown: 'slideInDown',
						slideInLeft: 'slideInLeft',
						slideInRight: 'slideInRight',
						bounceIn: 'bounceIn',
						bounceInUp: 'bounceInUp',
						bounceInDown: 'bounceInDown',
						bounceInLeft: 'bounceInLeft',
						bounceInRight: 'bounceInRight',
						rotateIn: 'rotateIn',
						rotateInDownLeft: 'rotateInDownLeft',
						rotateInDownRight: 'rotateInDownRight',
						rotateInUpLeft: 'rotateInUpLeft',
						rotateInUpRight: 'rotateInUpRight'
					}
				}
			},
			visitor: {
				keys: {
					firstName: 'visitorFirstName',
					lastName: 'visitorLastName',
					email: 'visitorEmail',
					avatarUrl: 'visitorAvatarUrl',
					phoneNumber: 'visitorPhoneNumber',
					question: 'visitorQuestion',
					company: 'visitorCompany',
					name: function (details) {
						// map name to first/last name props.
						var firstName;
						var lastName;
						var indexOfSpace = details.value.indexOf(" ");
						if (indexOfSpace > 0) {
							firstName = details.value.substring(0, indexOfSpace);
							lastName = details.value.substring(indexOfSpace + 1);
						} else {
							firstName = details.value;
						}
						this.chatModel().set('visitorFirstName', firstName);
						this.chatModel().set('visitorLastName', lastName);
					}
				},
				values: {}
			}
		},

		reverseMapVisitorDetails: function (details) {
			var obj = {};
			for (var key in this.mappings.visitor.keys) {
				obj[key] = details[this.mappings.visitor.keys[key]];
			}
			return obj;
		},
		getMappedWidgetValue: function (propName, propVal) {
			if (typeof propVal === 'string' && this.mappings.chatBox.values[propName]) {
				for (var valKey in this.mappings.chatBox.values[propName]) {
					if (valKey.toLowerCase() == propVal.toLowerCase()) {
						return this.mappings.chatBox.values[propName][valKey];
					}
				}
			}
			return propVal;
		},
		canSetChatBoxProp: function (pName) {
			switch (pName) {
				case 'available':
					return false;
				default:
					return true;
			}
		},
		set: function (propName, propVal) {
			Backbone.Model.prototype.set.apply(this, arguments);
			if (typeof propName === 'object') {
				// A hash was passed in, rather than a propName, so we need to call this fnc recursively
				for (var prop in propName) {
					this.set(prop, propName[prop]);
				}
			} else {
				// Standard two params were specified, a name and a value
				var pName;
				if (this.regexs.propAccess.chatBox.test(propName)) {
					// Widget settings
					pName = propName.split(this.regexs.propAccess.chatBox);
					pName = pName.length > 1 ? pName[1] : null;
					var keys = this.mappings.chatBox.keys;
					if (pName && keys[pName]) {
						var defaultSetter = this.setWidgetSetting;
						var propertyKeyName = keys[pName];

						if (_.isObject(propertyKeyName)) {
							defaultSetter = propertyKeyName["setter"] || defaultSetter;
							propertyKeyName = propertyKeyName["propertyName"]
						}

						propVal = this.getMappedWidgetValue(pName, propVal);
						defaultSetter.call(this, keys[pName], propVal);

						// Manually trigger an event that says the change is coming from a JS API call
						this.widgetSettings().trigger('api:change', this.widgetSettings, keys[pName], propVal);
					}
				} else if (this.regexs.propAccess.visitor.test(propName)) {
					// Visitor detail
					pName = propName.split(this.regexs.propAccess.visitor);
					pName = pName.length > 1 ? pName[1] : null;
					var mappingKey = this.mappings.visitor.keys[pName];
					if (pName && this.mappings.visitor.keys[pName]) {
						var isInChat = this.chatModel().get('roomId') || this.viewController.getDataController().checkInRoom();
						if ((this.mappings.visitor.keys.question == mappingKey && !isInChat) ||
							this.mappings.visitor.keys.question != mappingKey) {

							if (typeof mappingKey === 'function') {
								mappingKey.call(this, { value: propVal });
							} else {
								this.chatModel().set(mappingKey, propVal, {
									silent: false
								});
								this.chatModel().trigger('api:change', this.chatModel(), this.mappings.visitor.keys[pName], propVal);
							}
						}
					}
				}
			}
		},
		getRequestedPropName: function (request, regex) {
			var pName = request.split(regex);
			return pName.length > 1 ? pName[1] : null;
		},
		get: function (propName) {
			var pName = null;
			if (this.regexs.propAccess.chatBox.test(propName)) {
				// Widget settings
				pName = this.getRequestedPropName(propName, this.regexs.propAccess.chatBox);
				if (pName && this.mappings.chatBox.keys[pName]) {
					switch (pName) {
						case 'available':
							return this.chatModel() ? this.chatModel().get('operatorsAvailable') : null;
						default:
							return this.widgetSettings() ? this.widgetSettings().get(this.mappings.chatBox.keys[pName]) : null;
					}
				}
			} else if (this.regexs.propAccess.visitor.test(propName)) {
				pName = this.getRequestedPropName(propName, this.regexs.propAccess.visitor);
				if (pName && this.mappings.visitor.keys[pName] && this.chatModel) {
					return this.chatModel().get(this.mappings.visitor.keys[pName]);
				}
			}
			return null;
		},
		on: function (evtName) {
			var allow = this.regexs.events.chat.test(evtName) ||
				this.regexs.events.chatBox.test(evtName) ||
				this.regexs.events.email.test(evtName) ||
				this.regexs.events.visitor.test(evtName) ||
				this.regexs.events.chatBoxPropChange.test(evtName);
			if (allow) {
				// Currently, just do a shallow check to see if the event prefix matches ones we are allowing
				Backbone.Model.prototype.on.apply(this, arguments);
				return;
			}
			throw new Error('"' + evtName + '" is not a valid purechatApi event');
		},
		off: function (evtName) {
			if (this.regexs.events.chat.test(evtName) || this.regexs.events.chatBox.test(evtName)) {
				Backbone.Model.prototype.off.apply(this, arguments);
			}
		},
		clearViewController: function () {
			this.viewController = null;
		},
		setViewController: function (viewController) {
			this.viewController = viewController;
		},
		clearWidgetSettings: function () {
			this.widgetSettings = null;
		},
		setWidgetSettings: function (widgetSettings) {
			this.widgetSettings = widgetSettings;
		},
		clearChatModel: function () {
			this.chatModel = null;
		},
		setChatModel: function (chatModel) {
			this.chatModel = chatModel;
		},
		unbindEvents: function () {
			for (var evt in this.events) {
				Backbone.Model.prototype.off.apply(this, evt, this.events[evt]);
			}
		},
		bindEvents: function () {
			for (var evt in this.events) {
				Backbone.Model.prototype.on.apply(this, evt, this.events[evt]);
			}
		},
		initialize: function () {
			// Wire up all events in events hash when the constructor is called
			this.bindEvents();
		},
		onDestroy: function () {
			this.unbindEvents();
			Backbone.Model.prototype.off.apply(this);
		}
	});

	Models.addInitializer(function () {

	});
	Models.addFinalizer(function () {

	});
});


// Constants
var MESSAGE_DISPLAY_WIDTH = 40; // The width in characters of the message display area

purechatApp.module("Controllers", function(Controllers, app, Backbone, Marionette, $, _, Models) {
	Controllers.PureChatController = Controllers.PureChatApiController.extend({
		setChatModel: function(model) {
			this.chatModel = model;
		},
		getChatModel: function() {
			return this.chatModel;
		},
		setDataController: function(dc) {
			this.dc = dc;
		},
		getDataController: function() {
			return this.dc;
		},
		popoutChatOnExpand: function(dataController, settings, chatModel, state, goToMobile) {
			chatModel.set('poppedOut', true);
			state.disable();
			dataController.connectionInfo.persistLocalStorage();
			var url = settings.pureServerUrl + '/VisitorWidget/ChatWindow' +
				'?widgetId=' + settings.widgetId +
				'&userId=' + dataController.connectionInfo.get('userId') +
				'&displayName=' + dataController.connectionInfo.get('visitorName') +
				'&authToken=' + dataController.connectionInfo.get('authToken') +
				'&roomId=' + dataController.connectionInfo.get('roomId') +
				'&chatId=' + dataController.connectionInfo.get('chatId') +
				'&origin=' + encodeURIComponent(chatModel ? chatModel.get('origin') : '');
			if (!goToMobile) {
				window.openedWindow = window.open(url, 'purechatwindow', 'menubar=no, location=no, resizable=yes, scrollbars=no, status=no, width=480, height=640');
			} else {
				window.openedWindow = window.open(url, '_blank');
			}
			this.trigger('widget:poppedOut');
		},
		resetVisitorQuestion: function() {
			this.getChatModel().set('visitorQuestion', null);
		},
		triggerResizedEvent: function() {
			var self = this;

			if (self.resizeTrigger) {
				clearTimeout(self.resizeTrigger);
			}

			self.resizeTrigger = setTimeout(function() {
				self.resizeTrigger = null;

				if (!self.widgetLayout || !self.widgetLayout.$el) {
					return;
				}

				var width = self.widgetLayout.$el.width();

				//this is legacy for wix.  Should go away shortly.
				self.widgetLayout.trigger('resized', {
					height: 390,
					width: width
				});

				self.widgetLayout.trigger('widget:resized', {
					height: 390,
					width: width
				});

				if (self.resizeTrigger2) {
					clearTimeout(self.resizeTrigger2);
				}


				self.resizeTrigger2 = setTimeout(function() {
					self.resizeTrigger2 = null;

					//api-todo: what should we pass as the arguments to the callback
					var height = self.widgetLayout.$el.height();
					if (height === 0) {
						var image = self.widgetLayout.$el.find('img.collapsed-image');
						if (image.length > 0) {
							height = image.height();
							width = image.width();
						}
					}

					//this is legacy for wix.  Should go away shortly.
					self.widgetLayout.trigger('resized', {
						height: height,
						width: width
					});

					self.widgetLayout.trigger('widget:resized', {
						height: height,
						width: width
					});
				}, 1000);

			}, 0);
		},
		unbindAppLevelCommands: function() {
			app.commands.removeHandler('roomHostChanged');
		},
		bindAppLevelCommands: function() {
			var self = this;
			try {
				this.unbindAppLevelCommands();
			} catch (ex) {

			}
			app.commands.setHandler('roomHostChanged', function(args) {
				// Since the chat server client doesn't have access to the publicAPI (at least, not according to my knowledge) we're just piping in one event to another
				if (!self.options.get('AllowWidgetOnMobile') && self.options.get('RequestFromMobileDevice') || !self.options.get('RequestFromMobileDevice')) {
					self.getPublicApi().trigger('room:hostChanged', args);
				}
			});
		},
		getStyleURL: function() {
			var self = this;
			var sheetUrl = null;
			var cssVersion = this.options.get('version') + this.options.get('CssVersion');
			var requestFromMobile = this.options.isMobileRequest();
			var allowOnMobile = this.options.isAllowedOnMobile();
			if (this.options.get('isPersonalChat')) {
				if (requestFromMobile && !this.options.isDesktopDimension()) {
					sheetUrl = this.options.get('apiCdnServerUrl') + '/VisitorWidget/WidgetCss/personal-mobile/' + this.options.get('Color') + '/' + cssVersion + '.css';
				} else {
					sheetUrl = this.options.get('apiCdnServerUrl') + '/VisitorWidget/WidgetCss/personal/' + this.options.get('Color') + '/' + cssVersion + '.css';
				}
			} else if (requestFromMobile && allowOnMobile && !this.options.isDesktopDimension()) {
				sheetUrl = this.options.get('apiCdnServerUrl') + '/VisitorWidget/WidgetCss/mobile/' + this.options.get('Color') + '/' + cssVersion + '.css';
			} else {
				sheetUrl = this.options.get('apiCdnServerUrl') + '/VisitorWidget/WidgetCss/' + this.options.get('StyleName') + '/' + this.options.get('Color') + '/' + cssVersion + '.css';
			}
			return sheetUrl;
		},
		bindVisitorTrackingEvents: function() {
			var self = this;
			if (this.vtftw) {
				this.vtftw.on('purechat:startChat', function(args) {
					self.onFormSubmitted({
						operatorJoinIds: args.eventArgs.operatorJoinIds || [],
						initiator: 1,
						startedByOperator: true
					});
				});
			}
		},
		unbindVisitorTrackingEvents: function() {
			if (this.vtftw) {
				this.vtftw.off('purechat:startChat');
			}
		},
		isBanned: function () {
			var banned = this.options.get('IPIsBanned');
			if (banned) {
				try {
					return JSON.parse(banned.toString().toLowerCase());
				} catch (e) { return false; }
			} else {
				return false;
			}
		},
		startVisitorTracking: function () {
			if (!this.getChatModel().get('isOperator') && this.options.get('IsVisitorTrackingEnabledForAccount')) {
				var feature = _.find(this.options.get('Features'), function(f) {
					return f.Status != app.Constants.FeatureStatus.Off && f.Feature == app.Constants.Features.VisitorTracking;
				});
				// This is checking to make sure we're not tracking the in-dash beta widget
				var isAllowed = this.options.get('Type') != app.Constants.PersonalChatType;
				if (isAllowed && feature && (!this.vtftw || !this.vtftw.initialized)) {
					var additionalInfo = {
						widgetId: this.options.get('overrideWidgetId') || this.options.get('Id'),
						widgetName: this.options.get('Name')
					};
					if (this.isBanned()) { additionalInfo.isBanned = true; }

					// Uncomment this to track people by their widget ID
					this.vtftw = new tracker(vtConfig, tinyAjax, this.options.get('AccountId'));
					this.vtftw.setAdditionalInfo(additionalInfo);
					this.vtftw.init();
					this.bindVisitorTrackingEvents();
				}
			}
		},
		disableVisitorTrackingInactivity: function() {
			if (this.vtftw) {
				this.vtftw.setUserAlwaysActive();
			}
		},
		enableVisitorTrackingInactivity: function() {
			if (this.vtftw) {
				this.vtftw.unsetUserAlwaysActive();
			}
		},
		coalesceStartChatData: function(data) {
			var chatModel = this.getChatModel();
			if (!chatModel.get('visitorFirstName') || (data.visitorFirstName && chatModel.get('visitorFirstName') != data.visitorFirstName)) {
				chatModel.set('visitorFirstName', data.visitorFirstName);
			}
			if (!chatModel.get('visitorLastName') || (data.visitorLastName && chatModel.get('visitorLastName') != data.visitorLastName)) {
				chatModel.set('visitorLastName', data.visitorLastName);
			}
			if (!chatModel.get('visitorName') || (data.visitorName && chatModel.get('visitorName') != data.visitorName)) {
				chatModel.set('visitorName', data.visitorName);
			}
			if (!chatModel.get('visitorEmail') || (data.visitorEmail && chatModel.get('visitorEmail') != data.visitorEmail)) {
				chatModel.set('visitorEmail', data.visitorEmail);
			}
			if (!chatModel.get('visitorQuestion') || (data.visitorQuestion && chatModel.get('visitorQuestion') != data.visitorQuestion)) {
				chatModel.set('visitorQuestion', data.visitorQuestion);
			}
			if (!chatModel.get('visitorPhoneNumber') || (data.visitorPhoneNumber && chatModel.get('visitorPhoneNumber') != data.visitorPhoneNumber)) {
				chatModel.set('visitorPhoneNumber', data.visitorPhoneNumber);
			}
			return $.extend(data, chatModel.attributes);
		},
		onFormSubmitted: function(data) {
			var self = this;
			var inRoom = self.getDataController().checkInRoom();
			var form = self.widgetLayout.$el.find('.purechat-form.purechat-init-form');
			var chatModel = this.getChatModel();
			if (form && form.length > 0) {
				app.execute('spinner:show', form);
			}
			if (!self.state.submittingChat) {
				if (inRoom) {
					app.execute('spinner:hide', form);
					chatModel.set('state', app.Constants.WidgetStates.Activating);
				} else {
					self.submittingChat = true;
					data.origin = chatModel.get('origin');
					var a = self.getDataController()
						//.startChat(data)
						.startChat(this.coalesceStartChatData(data))
						.done(function(chatConnectionInfo) {
							app.Utils.GaEvent(self.options, 'GaTrackingChat', 'GAChatEvent');
							self.widgetLayout.$el.find('.purechat-init-form').find('.general-error').text('').hide();
							self.state.status.chatInfo = chatConnectionInfo;
							self.state.status.initialData = data;
							chatModel.set({
								visitorFirstName: data.visitorFirstName,
								visitorLastName: data.visitorLastName,
								visitorName: data.visitorName,
								visitorEmail: data.visitorEmail,
								visitorQuestion: data.visitorQuestion,
								visitorPhoneNumber: data.visitorPhoneNumber,
								roomId: chatConnectionInfo.get('roomId'),
								userId: chatConnectionInfo.get('userId'),
								authToken: chatConnectionInfo.get('authToken'),
								chatId: chatConnectionInfo.get('chatId'),
								state: app.Constants.WidgetStates.Chatting
							});
							self.getDataController().connectionInfo.persistLocalStorage();
						})
						.fail(function(message) {
							self.log("Error", "Unable to start chat. WidgetId: " + self.options.get('widgetId') + ", Message:" + (message || "None"));
							self.widgetLayout.$el.find('.purechat-init-form').find('.general-error').text('Unable to start chat. Please try again').show();
						})
						.always(function() {
							self.state.submittingChat = false;
							if (form && form.length > 0) {
								app.execute('spinner:hide', form);
							}
						});
				}
			}
		},
		initialize: function(options) {
			var self = this;
			//There was a problem with people haveing there loader script being cached and this value isn't being set
			//so we are going to default it to a prod url for now to get it to work for them.
			if (!options.get("apiCdnServerUrl")) {
				options.set("apiCdnServerUrl", "https://cdnva2.purechat.com/api");
			}

			app.pureServerUrl = options.get('pureServerUrl');
			var deferred = $.Deferred();
			var chatModel = new purechatApp.Models.Chat({
				isWidget: options.get('isWidget'),
				position: options.get('position'),
				pureServerUrl: options.get('pureServerUrl'),
				cdnServerUrl: options.get('cdnServerUrl') || options.get('pureServerUrl'),
				apiCdnServerUrl: options.get('apiCdnServerUrl'),
				widgetType: app.Constants.WidgetType.Tab,
				isOperator: options.get('isOperator'),
				isPoppedOut: options.get('poppedOut'),
				State: app.Constants.WidgetStates.Inactive,
				messages: new purechatApp.Models.MessageCollection(),
				operators: new purechatApp.Models.OperatorCollection(),
				origin: options.get('origin') || window.location.href,
				userId: options.get('userId')
			});
			self.setChatModel(chatModel);
			this.registerPublicApiEvents();
			if (options.get('isDemo')) {
				chatModel.set('operatorsAvailable', true);
				chatModel.set('visitorName', options.get('visitorName'));
				if (options.get('isPersonalChat') && options.get('isInEditorMode')) {
					window.pcDemoChatModel = chatModel;
				}
			}
			if (window.pcDashboard) {
				var socketIoLoaded = $.Deferred().resolve();
			} else {
				// Note: Including socket.io could cause problems if the host page is already using socket.io
				// NOTE: This version of socket.io has had the flash references manually removed until we can upgrade our mobile apps
				var socketIoLoaded = $.ajax({
					url: options.get('cdnServerUrl') + '/scripts/socket.io.0.9.16-noflash.js',
					dataType: "script",
					cache: true
				});
			}

			var dcReady = self.setupDataController(options, chatModel);

			function socketIOLoadComplete() {

				self.options.set(self.options.get('dataController').widgetSettings.widgetConfig);
				self.setupPageActivityTest();
				self.rm = self.options;

				self.options.set(self.getDataController().widgetSettings);

				$('.purechat-button-expand').find('.purechat-button-text').text(self.options.getResource('title_initial'), 'title_initial');

				chatModel.on("change:operatorsAvailable", function(model, available) {
					var expandButtons = $('.purechat-button-expand');

					expandButtons.filter(':not(.purechat)').click(function(e) {
						var dataController = self.getDataController();
						if (!$(e.target).hasClass('pc-icon-caret-down') && !$(e.target).hasClass('purechat-super-minimize-link-button') && (dataController.options.ForcePopout && !self.chatModel.get('isPoppedOut') || dataController.options.usePrototypeFallback)) {
							self.popoutChatOnExpand(dataController, dataController.options, self.chatModel, self.state);
						} else {
							self.widgetLayout.triggerMethod('expand', e, {
								collapse: ($(e.target).hasClass('btn-collapse') || $(e.target).hasClass('pc-icon-minus')),
								superMinimize: $(e.target).hasClass('pc-icon-caret-down') || $(e.target).hasClass('pc-icon-caret-up') || $(e.target).hasClass('purechat-super-minimize-link-button')
							});
						}
					});

					if (available) {
						expandButtons.addClass('purechat-button-available');
						expandButtons.removeClass('purechat-button-unavailable');
						expandButtons.removeClass('purechat-button-hidden');
						expandButtons.removeAttr("disabled");
						chatModel.trigger('widget:available');
					} else {
						if (self.options.get('UnavailableBehavior') === 0) {
							expandButtons.removeClass('purechat-button-available');
							expandButtons.addClass('purechat-button-unavailable');
							expandButtons.attr("disabled", "disabled");
						}

						expandButtons.each(function() {
							var next = $(this);
							var hideString = next.attr('HideUnavailable');
							var hide;
							if (!hideString)
								hide = (self.options.get('UnavailableBehavior') === 0);
							else
								hide = (hideString == "true");

							if (hide) {
								next.addClass('purechat-button-hidden');
							}
						});
						chatModel.trigger('widget:unavailable');
					}
				});
				self.getDataController().connectionInfo.isInChat() ||
					self.getDataController().connectionInfo
					.loadFromLocalStorage();
				chatModel.set('userId', self.getDataController().connectionInfo.get('userId'));
				self.widgetLayout = new purechatApp.Views.WidgetLayout({
					viewController: self,
					rm: self.rm,
					model: chatModel,
					widgetSettings: self.options
				});
				self.widgetLayout.render();
				self.widgetLayout.onHide();

				if (!self.getDataController().connectionInfo.get('chatActiveInOtherWindow') && self.getDataController().connectionInfo.get('disabled') && self.getDataController().connectionInfo.get('roomId')) {
					self.widgetLayout.$el.hide();
				} else if (self.getDataController().connectionInfo.get('chatActiveInOtherWindow')) {
					self.widgetLayout.triggerMethod('collapse');
				}

				var styleLoadingComplete = function() {
					var renderInto = $(options.get('renderInto'));
					renderInto.append(self.widgetLayout.$el);
					renderInto.on("selectionShow", function() {
						self.triggerMethod("selectionShow");
					});
					self.bindGobalCommand(self.widgetLayout.$el);
					self.triggerMethod('rendered');
					//todo need to fix up this setup.
					self.options.get('dataController').options.chatModel = self.getChatModel();
					self.listenTo(chatModel, "change:state", self.stateChange);
					chatModel.set('state', self.options.get('initialState') || app.Constants.WidgetStates.Initializing);
					self.listenTo(self.widgetLayout.$el, "change:state", self.stateChange);
					self.widgetLayout.$el.removeClass('hide');
					self.widgetLayout.triggerMethod('afterInsertion');
					self.trigger('widget:ready');
					if (!self.chatModel.get('expanded') && self.options.useMobile() && !self.options.isDesktopDimension()) {
						setTimeout(function() {
							self.widgetLayout.collapseMobile();
						}, 1000);
					}
					self.setUpUiTriggers();
					self.startVisitorTracking();
				};
				if (self.options.get('isOperator')) {
					styleLoadingComplete();
				} else {
					var styleLoaded = false;
					var browserName = self.options.get('BrowserDetails').Browser || '';
					var browserVersion = parseFloat(self.options.get('BrowserDetails').Version || '');
					var browserOS = self.options.get('BrowserDetails').OS || 'Other';
					var sheetUrl = self.getStyleURL();
					var sheet = $('<link rel="stylesheet" href="' + sheetUrl + '" type="text/css">');
					var count = 0;
					if (/safari/i.test(browserName) && browserOS == 'Windows') {
						console.log('Safari on Windows detected');
						sheet.appendTo('head');
						var interval = setInterval(function() {
							if (sheet[0].sheet || count >= 150) {
								if (!styleLoaded) {
									styleLoaded = true;
									interval = clearInterval(interval);
									styleLoadingComplete();
								}
							}
							count++;
						}, 100);
					} else {
						sheet.appendTo('head').on('load', function() {
							styleLoaded = true;
							styleLoadingComplete();
						});
					}
				}
			}

			$.when(dcReady, socketIoLoaded)
				.done(socketIOLoadComplete)
				.fail(function() {
					self.trigger('widget:fail');
				});
			this.on('all', function() {
				if (self.state)
					self.state.triggerMethod.apply(self.state, arguments);
			});
			this.on('chat:start', function() {
				self.disableVisitorTrackingInactivity();
			});
			this.on('chat:end', function() {
				self.enableVisitorTrackingInactivity();
			});
		},
		setUpUiTriggers: function() {
			var timeBasedTrigger = new app.Triggers.TimeBasedTrigger(this);
			var urlBaseTrigger = new app.Triggers.UrlBasedTrigger(this);
		},
		setupDataController: function(options, chatModel) {
			var settingsDeferred = this.options.get('dataController').loadWidgetSettings();
			this.setDataController(this.options.get('dataController'));
			return settingsDeferred;
		},
		setupPageActivityTest: function() {
			var self = this;
			var tid = null;
			var lastX = -9999;
			var lastY = -9999;
			self.pageActivity = false;

			//See if there has been a mouse move in the last X seconds
			//and update the pageActivity cache. Its cashed
			$(document).on('mousemove.setupPageActivityTest', ($.throttle(10000, function(e) {
				if (tid)
					clearTimeout(tid);

				if (Math.abs(lastX - e.clientX) <= 2 && Math.abs(lastY - e.clientY) <= 2) {
					return;
				}

				lastX = e.clientX;
				lastY = e.clientY;

				self.pageActivity = true;

				tid = setTimeout(function() {
					self.pageActivity = false;
				}, 45000);
			})));
		},
		onSelectionShow: function() {
			if (this.state) {
				this.state.triggerMethod("selectionShow");
			}
		},
		stateChange: function(model, newState) {
			var state = new app.Controllers.States[newState](this.options);
			this.setState(state);
		},
		setState: function(newState) {
			var oldState = this.state;
			var status = {};
			if (this.state != null) {
				status = this.state.status;
				this.state.triggerMethod('exit');
				this.state.destroy();
				//this.state.setChatModel(null);
				//this.state.widgetView = null;
				//this.state.setWidgetSettings(null);
				//this.state.setResources(null);
				//this.state.setDataController(null);
				//this.state.setViewController(null);
			}
			this.state = newState;
			this.state.status = status;
			this.state.setChatModel(this.getChatModel());
			this.state.setWidgetView(this.widgetLayout);
			this.state.setWidgetSettings(this.options);
			this.state.setResources(this.rm);
			this.state.setDataController(this.getDataController());
			this.state.setViewController(this);

			this.trigger('state:changed', { oldState: oldState, newState: newState })

			this.state.triggerMethod('enter');
			this.triggerResizedEvent();
		},
		bindGobalCommand: function($el) {
			var self = this;
			$el.on('click.delegateEvents', '[data-command]', function(e) {
				e.preventDefault();
				var $this = $(this),
					command = $this.data('command'),
					commandParams = $this.data('command-params');
				self.trigger(command, commandParams);
			});
		},
		showConfirmationDialog: function() {
			return $.Deferred.resolve();
		},
		undelegateEvents: function() {
			this.$el.off('.delegateEvents' + this.cid);
			return this;
		},
		onClose: function() {

		},
		onDestroy: function() {
			$(document).off('.setupPageActivityTest');
			var dataController = this.getDataController();

			dataController.unbindHandlerEvents();
			dataController.chatServerConnection = null;
			dataController.destroy();
			this.widgetLayout.destroy();
			this.state.destroy();
			this.state = null;
			this.widgetLayout = null;
			this.setDataController(null);
			this.setChatModel(null);

			if (this.resizeTrigger) {
				clearTimeout(this.resizeTrigger)
				this.resizeTrigger = null;
			}

			if (this.resizeTrigger2) {
				clearTimeout(this.resizeTrigger2)
				this.resizeTrigger2 = null;
			}

			if (this.options) {

				this.options.attributes.dataController = null;
				this.options.attributes.renderInto = null;
				this.options._previousAttributes.dataController = null;
				this.options._previousAttributes.renderInto = null;
				this.options = null;
			}
			this.unbindAppLevelCommands();
		},
		roomHostChanged: function(args) {
			var chatModel = this.getChatModel();
			for (var key in args) {
				chatModel.set(key, args[key], {
					silent: true
				});
			}
			chatModel.trigger('roomHostChanged');
		}
	});

	function getStartTime(time, timeElapsed) {
		var now = new Date();
		var utcNowDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
		var differenceSeconds = (utcNowDate.getTime() / 1000 - time);
		var newTime = parseInt(time, 10) - (parseInt(timeElapsed, 10) - differenceSeconds);
		return newTime * 1000;
	}

	var DashboardChatController = Controllers.PureChatController.extend({
		onRendered: function() {
			// This gets called when the operator widget is done being rendered
			if (this.options.get('isInvisible')) {
				this.widgetLayout.setTitle(this.options.get('room').name + ' (Eavesdropping)');
			} else {
				this.widgetLayout.setTitle(this.options.get('room').name);
			}
			// fetch the referer url and time elapsed and add them to the widget
			if (this.options.get('room').roomType == PureChat.enums.roomType.visitor) {
				//todo chad need to fixe this section to not do all of this append crap
				var refererLink = this.options.get('room').visitorReferer;
				if (refererLink != 'Unknown') {
					refererLink = '<a target="_blank" href="' + refererLink + '">' + refererLink + '</a>';
				}
				var referer = $('<div class="chat-referer" title="' + this.options.get('room').visitorReferer + '">' + refererLink + '</div>');

				var startTime;
				if (this.options.get('room').timeElapsed != null)
					startTime = getStartTime(this.options.get('room').time, this.options.get('room').timeElapsed);
				else // if no timeElapsed, time has already gone though getStartTime method
					startTime = room.time;

				var timer = $('<div class="purechat-start time"></div>');
				timer.attr('start-time', startTime);

				this.widgetLayout.$el.find('.purechat-chat-info').append(timer);
				this.widgetLayout.$el.find('.purechat-chat-info').append(referer);
			} else {
				var info = $('<div class="operator-bar">Operator Room</div>');
				this.widgetLayout.$el.find('.purechat-chat-info').append(info);
			}
			if (pcDashboard) pcDashboard.vent.trigger("chat:selected", this.rm.get('room').id);
		},
		showConfirmationDialog: function(confirmation, title) {
			var $d = $.Deferred();
			var dialog = window.showConfirmationDialog({
				title: title || "Are you sure?",
				bodyText: confirmation,
				onConfirm: function() {
					$d.resolve();
					dialog.modal('hide');
				}
			});

			return $d;
		}
	});
	Controllers.DashboardChatController = DashboardChatController;
}, purechatApp.Models);
_PCWidget = function(connectionSettings) {
	connectionSettings.pureServerUrl = connectionSettings.pureServerUrl || 'https://www.purechat.com';
	var dataController;
	var dataControllerOptions = {
		test: false,
		widgetId: connectionSettings.widgetId || connectionSettings.c,
		connectionSettings: connectionSettings,
		isWidget: connectionSettings.isWidget || connectionSettings.f,
		isOperator: (connectionSettings.d == undefined ? false : connectionSettings.d),
		pureServerUrl: connectionSettings.pureServerUrl,
		renderInto: $('body')
	};
	window._pcDisableAvailabilityPings = connectionSettings.DisableAvailabilityPings || connectionSettings.IPIsBanned;
	if (dataControllerOptions.test) {
		dataController = new purechatApp.Controllers.TestDataController(dataControllerOptions);
	} else {
		dataController = new purechatApp.Controllers.PCDataController($.extend(connectionSettings, dataControllerOptions));
	}
	var usePrototypeFallback = false;
	var prototypeErrorMessage = '';
	if (typeof Prototype !== 'undefined') {
		try {
			var splitVersion = Prototype.Version.split(/\./g);
			if (splitVersion.length > 0) {
				usePrototypeFallback = parseInt(splitVersion[0]) >= 2 ? false : parseInt(splitVersion[1]) >= 7 ? false : true;
			}
		} catch (ex) {
			prototypeErrorMessage = ex;
		}
	}
	if (usePrototypeFallback) {
		prototypeErrorMessage = 'PureChat widgets are not compatible with Prototype.js versions < 1.7. Default widget behavior will popout into a new window';
	}
	if (prototypeErrorMessage.length > 0) {
		if (typeof console !== 'undefined' && console !== null) {
			console.log(prototypeErrorMessage);
		}
	}
	var viewOptions = {
		test: false,
		pureServerUrl: connectionSettings.pureServerUrl,
		widgetId: connectionSettings.widgetId || connectionSettings.c,
		isWidget: connectionSettings.isWidget || connectionSettings.f,
		isOperator: (connectionSettings.d == undefined ? false : connectionSettings.d),
		renderInto: $('body'),
		dataController: dataController,
		usePrototypeFallback: usePrototypeFallback
	};
	viewOptions = $.extend(connectionSettings, viewOptions);
	var c1 = new purechatApp.Controllers.PureChatController(
		new purechatApp.Models.WidgetSettings(viewOptions)
	);
	purechatApp.Notifications.controller = new purechatApp.Notifications.Controller({
		settings: c1.options
	});
	return c1;
};

purechatApp.module("Triggers", function(Triggers, app, Backbone, Marionette, $, _, Models) {


	//Time conversion constants
	Triggers.MILLISECONDS_IN_SECOND = 1000;
	Triggers.SECONDS_IN_MINUTE = 60;
	Triggers.MINUTES_IN_HOUR = 60;
	Triggers.HOURS_IN_DAY = 24;

	Triggers.MILLISECONDS_IN_DAY =
		Triggers.HOURS_IN_DAY *
		Triggers.MINUTES_IN_HOUR *
		Triggers.SECONDS_IN_MINUTE *
		Triggers.MILLISECONDS_IN_SECOND;

	// This constant controls how long we wait on each succesive dismissal of the widget when it is popped up via trigger;
	Triggers.DISMISS_DELAYS_DAYS = [0, 1, 3, 7, 30, 365];


	Triggers.CHECKIN_INTERVAL_SECONDS = 5;
	Triggers.MAX_CHECKIN_INTERVAL_SECOND = 60;


	var DismissSettings = Backbone.Model.extend({
		storageKeys: ["_purechatSessionStart", "_purechatLastCheckin", "_purechatDismissTime", "_pureChatTimeSettingsVersion", "_purechatDismissCount"],
		defaults: {
			_purechatSessionStart: new Date(),
			_purechatPageStart: new Date(),
			_purechatLastCheckin: new Date(),
			_purechatDismissCount: 0
		},

		fetchDate: function(nextKey) {
			var val = window.localStorage.getItem(this.formatPropName(nextKey));
			if (!_.isUndefined(val) && !_.isNaN(val) && !_.isNull(val)) {
				this.set(nextKey, new Date(window.localStorage.getItem(this.formatPropName(nextKey))));
			}
		},
		fetchInt: function(nextKey) {
			var val = window.localStorage.getItem(this.formatPropName(nextKey));
			if (!_.isUndefined(val) && !_.isNaN(val) && !_.isNull(val)) {
				this.set(nextKey, parseInt(window.localStorage.getItem(this.formatPropName(nextKey))), 10);
			}
		},
		formatPropName: function(prop) {
			return this.widgetId + '_' + prop;
		},
		fetch: function() {
			var self = this;
			this.fetchDate("_purechatSessionStart");
			this.fetchDate("_purechatLastCheckin");
			this.fetchDate("_purechatDismissTime");
			this.fetchInt("_pureChatTimeSettingsVersion");
			this.fetchInt("_purechatDismissCount");
		},
		save: function() {
			var self = this;
			this.storageKeys.forEach(function(nextKey, index) {
				var val = self.get(nextKey);
				if (!_.isUndefined(val) && !_.isNaN(val) && !_.isNull(val)) {
					window.localStorage.setItem(self.formatPropName(nextKey), self.get(nextKey));
				} else {
					window.localStorage.removeItem(self.formatPropName(nextKey));
				}
			});
		},
		resetTimeCounters: function() {
			this.set({
				_purechatDismissTime: null,
			});
		},
		updateEventLoop: function() {
			this.set('_purechatLastCheckin', new Date());
			window.localStorage.setItem(this.formatPropName('_purechatLastCheckin'), this.get('_purechatLastCheckin'));
		},
		initialize: function() {
			_.bindAll(this, 'updateEventLoop');
			setInterval(this.updateEventLoop, Triggers.CHECKIN_INTERVAL_SECONDS * Triggers.MILLISECONDS_IN_SECOND);
		}
	});

	var BaseControllerSettings = Marionette.Controller.extend({
		isPoppedOut: function() {
			return this.widgetSettings.get('isPoppedOut');
		},
		isHosted: function() {
			return this.widgetSettings.get('isDirectAccess');
		},
		isPersonalChat: function() {
			return this.widgetSettings.get('isPersonalChat');
		},
		isDemoChat: function() {
			return this.widgetSettings.get('isDemo');
		},
		isMobile: function() {
			return this.widgetSettings.get('RequestFromMobileDevice');
		},
		isWidgetAvailable: function() {
			return this.purechatController.chatModel.get('operatorsAvailable');
		},
		popOutAutomatically: function() {
			return this.widgetSettings.get('ForcePopout') || false;
		},
		initialize: function(purechatController) {

			var self = this;
			this.purechatController = purechatController;
			this.widgetSettings = purechatController.options;
			this.enabled = this.widgetSettings.get(this.enabledWidgetSettingKey)
				&& !this.isPoppedOut()
				&& !this.isHosted()
				&& !this.isPersonalChat()
				&& !this.isDemoChat()
				&& !this.isMobile()
				&& !this.popOutAutomatically();
			if (this.enabled) {

				//bind these functions to "this" to make them easier to pass around.
				_.bindAll(this, 'onCollapse');

				if (!BaseControllerSettings.dismissSettings) {
					BaseControllerSettings.dismissSettings = new DismissSettings();
					BaseControllerSettings.dismissSettings.widgetId = this.widgetSettings.get('Id');
					BaseControllerSettings.dismissSettings.fetch();

				}

				var settingsVersion = BaseControllerSettings.dismissSettings.get('_pureChatTimeSettingsVersion');
				var currentWidgetSettings = this.widgetSettings.get('WidgetSettingsVersion');

				if (!settingsVersion || settingsVersion != currentWidgetSettings) {
					BaseControllerSettings.dismissSettings.resetTimeCounters();
					BaseControllerSettings.dismissSettings.set('_pureChatTimeSettingsVersion', currentWidgetSettings);
				}


				if (this.isNewSession()) {
					BaseControllerSettings.dismissSettings.set('_purechatSessionStart', new Date());
				}

				this.purechatController.getPublicApi().on('chatbox:collapse', this.onCollapse);

				self.startTesting();
				BaseControllerSettings.dismissSettings.save();
			}
		},
		onCollapse: function() {
			BaseControllerSettings.dismissSettings.set('_purechatDismissCount', BaseControllerSettings.dismissSettings.get('_purechatDismissCount') + 1);
			this.stopTesting();
			BaseControllerSettings.dismissSettings.set('_purechatDismissTime', new Date());
			BaseControllerSettings.dismissSettings.save();
			this.purechatController.getPublicApi().off('chatbox:collapse', this.onCollapse);
		},
		getDismissDelay: function() {
			return Triggers.DISMISS_DELAYS_DAYS[Math.min(BaseControllerSettings.dismissSettings.get('_purechatDismissCount'), Triggers.DISMISS_DELAYS_DAYS.length - 1)] * Triggers.MILLISECONDS_IN_DAY;
		},
		isNewSession: function() {
			return ((new Date()) - BaseControllerSettings.dismissSettings.get('_purechatLastCheckin')) > (Triggers.MAX_CHECKIN_INTERVAL_SECOND * Triggers.MILLISECONDS_IN_SECOND);
		},
		startTesting: function() {
			var dismissTime = BaseControllerSettings.dismissSettings.get('_purechatDismissTime');
			var dismissLimit = this.getDismissDelay();
			//console.log('time since dismiss: ' + (new Date() - dismissTime));
			//console.log('dismisLimit: ' + dismissLimit);
			if (!dismissTime || (new Date() - dismissTime > dismissLimit)) {
				//console.log('start testing: dismisLimit: ' + dismissLimit);
				//this.interval = setInterval(this.checkTimeEvents, Triggers.CHECKIN_INTERVAL_SECONDS * Triggers.MILLISECONDS_IN_SECOND);
				BaseControllerSettings.dismissSettings.on("change:_purechatLastCheckin", this.eventCheckChange);
				if (this.onStart) {
					this.onStart();
				}
			}
		},
		removeEventListeners: function() {
			BaseControllerSettings.dismissSettings.off("change:_purechatLastCheckin", this.eventCheckChange);

		},
		stopTesting: function() {
			//console.log('stop testing');
			//clearInterval(this.interval);
			this.removeEventListeners();
			BaseControllerSettings.dismissSettings.resetTimeCounters();
			BaseControllerSettings.dismissSettings.set('_purechatDismissTime', new Date());
			BaseControllerSettings.dismissSettings.save();
			if (this.onStop) {
				this.onStop();
			}
		},
		triggerEvent: function(delay) {
			var self = this;
			this.purechatController.getDataController()
				.checkChatAvailable()
				.done(function(result) {
					if (result.available) {
						self.removeEventListeners();
						setTimeout(function() {
							if (!self.purechatController.chatModel.get('expanded')) {
								//console.log('expand');
								self.stopTesting();
								self.purechatController.getPublicApi().set('chatbox.expanded', true, {
									expandSource: Marionette.getOption(self, 'expandSource')
								});
							}
						}, delay || 1000);
					}
				})
				.fail(function() {

				});
		}
	});

	Triggers.BaseControllerSettings = BaseControllerSettings;


	Triggers.addInitializer(function(options) {
	});

	Triggers.addFinalizer(function() {
	});

});

purechatApp.module("Triggers", function(Triggers, app, Backbone, Marionette, $, _, Models) {


	var TimeBasedTrigger = Triggers.BaseControllerSettings.extend({
		expandSource: 'time-trigger',
		enabledWidgetSettingKey: 'ExpandWidgetTimeoutEnabled',
		initialize: function(purechatController) {
			Triggers.BaseControllerSettings.prototype.initialize.apply(this, arguments);

		},
		onStart: function() {
			var self = this;

			var expandWidgetTimeoutType = this.widgetSettings.get('ExpandWidgetTimeoutType');

			//Do we want to trigger based on thst session start or the page start.
			var startTimeKey = expandWidgetTimeoutType == 1 ? '_purechatSessionStart' : '_purechatPageStart';

			var timeSinceSessionStart = (new Date() - Triggers.BaseControllerSettings.dismissSettings.get(startTimeKey));
			var maxSessionLength = (this.widgetSettings.get('ExpandWidgetTimeout') * Triggers.MILLISECONDS_IN_SECOND);
			//console.log('timeSinceSessionStart:' + (timeSinceSessionStart / 1000));
			//console.log('maxSessionLength:' + (maxSessionLength / 1000));
			var delay = maxSessionLength - timeSinceSessionStart;

			this.timeout = setTimeout(function() {
				self.triggerEvent();
			}, delay)
		},
		onStop: function() {
			clearTimeout(this.timeout);
			delete this.timeout;
		}
		//eventCheckChange: function () {
		//	if (this.isPastTrigger()) {
		//		this.triggerEvent();
		//	}
		//},
		//isPastTrigger: function () {
		//	//Do we want to trigger based on thst session start or the page start.
		//    var startTimeKey = this.expandWidgetTimeoutType == 1 ? '_purechatSessionStart' : '_purechatPageStart';

		//	var timeSinceSessionStart = (new Date() - Triggers.BaseControllerSettings.dismissSettings.get(startTimeKey));
		//	var maxSessionLength = (this.widgetSettings.get('ExpandWidgetTimeout') * Triggers.MILLISECONDS_IN_SECOND);
		//	console.log('timeSinceSessionStart:' + (timeSinceSessionStart / 1000));
		//	console.log('maxSessionLength:' + (maxSessionLength / 1000));
		//	return timeSinceSessionStart > maxSessionLength;
		//}
	});

	Triggers.TimeBasedTrigger = TimeBasedTrigger;


	Triggers.addInitializer(function(options) {
	});

	Triggers.addFinalizer(function() {
	});

});

purechatApp.module("Triggers", function(Triggers, app, Backbone, Marionette, $, _, Models) {

	var UrlBasedTrigger = Triggers.BaseControllerSettings.extend({
		expandSource: 'url-trigger',
		enabledWidgetSettingKey: 'EnableTriggerPageSpecific',
		initialize: function(purechatController) {
			Triggers.BaseControllerSettings.prototype.initialize.apply(this, arguments);
		},
		onStart: function() {
			var self = this;
			var testUrls = this.widgetSettings.get('TriggerUrls');
			var triggerPageExpandTimeout = this.widgetSettings.get('TriggerPageExpandTimeout');

			var url = window.location.href.replace('http://', '').replace('https://', '')
			testUrls.forEach(function(next) {
				if (self.testUrl(url, next)) {
					self.triggerEvent(triggerPageExpandTimeout * Triggers.MILLISECONDS_IN_SECOND);
				}
			});
		},
		testUrl: function(currentUrl, currentTest) {
			return currentUrl.toLowerCase().indexOf(currentTest.Url.toLowerCase()) >= 0;
		}

	});

	Triggers.UrlBasedTrigger = UrlBasedTrigger;


	Triggers.addInitializer(function(options) {
	});

	Triggers.addFinalizer(function() {
	});

});
purechatApp.module('Notifications', function(Notifications, App, Backbone, Marionette, $, _, Models) {

	Notifications.Controller = Marionette.Controller.extend({
		notificationSoundTimeout: null,
		soundIsPlaying: false,
		_soundsFolder: '/content/sounds/notifications/',
		_localStorageKey: '_purechatVisitorWidgetPlaySound',
		_playSound: function(url) {
			var self = this;
			var audio = new Audio(url);
			audio.onerror = function() {
				console.log(arguments);
			};
			audio.onended = function() {
				self.soundIsPlaying = false;
				delete audio;
			};
			this.soundIsPlaying = true;
			audio.play();
		},
		_playWave: function(serverUrl) {
			this._playSound(serverUrl + this._soundsFolder + 'Correct-short.wav');
		},
		_playMp3: function(serverUrl) {
			this._playSound(serverUrl + this._soundsFolder + 'Correct-short.mp3');
		},
		newMessage: function() {
			var settings = Marionette.getOption(this, 'settings');
			if (!settings.get('RequestFromMobileDevice') && !settings.get('isInEditorMode')) {
				var serverUrl = settings.get('pureServerUrl') || 'https://app.purechat.com';
				var playSound = localStorage['_purechatVisitorWidgetPlaySound'].toString().toLowerCase() == 'true';
				if (!settings.get('isOperator') && playSound && typeof Audio !== 'undefined' && !this.soundIsPlaying) {
					var aTest = new Audio();
					var supportsWave = aTest.canPlayType('audio/wav') || aTest.canPlayType('audio/wave');
					if (!!supportsWave) {
						// Play wave file!
						this._playWave(serverUrl);
					} else {
						// Play mp3!
						this._playMp3(serverUrl);
					}
				}
			}
		},
		initialize: function() {
			var self = this;
			localStorage[this._localStorageKey] = typeof localStorage[this._localStorageKey] !== 'undefined' ? localStorage[this._localStorageKey].toString().toLowerCase() == 'true' : true;
			App.commands.setHandler('notifications:newMessage', function() {
				self.newMessage();
			});
		},
		onDestroy: function() {
			App.commands.removeHandler('notifications:newMessage');
		}
	});
});})(null, function() { return this; }());