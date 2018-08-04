/**
 * This is the file where commands get parsed
 *
 * Some parts of this code are taken from the Pokémon Showdown server code, so
 * credits also go to Guangcong Luo and other Pokémon Showdown contributors.
 * https://github.com/Zarel/Pokemon-Showdown
 *
 * @license MIT license
 */

var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require('url');

const ACTION_COOLDOWN = 3 * 1000;
const FLOOD_MESSAGE_NUM = 7;
const FLOOD_PER_MSG_MIN = 500; // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
const FLOOD_MESSAGE_TIME = 6 * 1000;
const MIN_CAPS_LENGTH = 12;
const MIN_CAPS_PROPORTION = 0.8;

global.parse = exports.parse = {
	actionUrl: url.parse('https://play.pokemonshowdown.com/~~' + Config.serverid + '/action.php'),

	data: function (data) {
		if (data.charAt(0) !== 'a') return false;
		data = JSON.parse(data.substr(1));
		if (Array.isArray(data)) {
			for (let i = 0, len = data.length; i < len; i++) {
				this.splitMessage(data[i]);
			}
		} else {
			this.splitMessage(data);
		}
	},
	splitMessage: function (message) {
		if (!message) return;

		var room = null;
		if (message.indexOf('\n') < 0) return this.message(message, room);
		let roomid;
		var spl = message.split('\n');
		if (spl[0].charAt(0) === '>') {
			if (spl[1].substr(1, 10) === 'tournament') return false;
			roomid = spl.shift().substr(1);
			room = Rooms.get(roomid);
			if (spl[0].substr(1, 4) === 'init') {
				if (spl[0].indexOf('battle') !== -1) {
					Battles.addBattle(roomid).handleMessages(spl);
				}
				let users = spl[2].substr(7);
				room = Rooms.add(roomid, !Config.rooms.includes(roomid));
				room.onUserlist(users);
				if (room.id === 'survivor') {
					Parse.say(room, '/roomauth survivor');
					setTimeout(() => checkHost(), 5 * 1000);
				}
				return ok('joined ' + room.id);					
			}
		}
		if (roomid in Battles.battles) {
			Battles.addBattle(roomid).handleMessages(spl);
		} else {
			for (let i = 0, len = spl.length; i < len; i++) {
				this.message(spl[i], room);
			}
		}
	},
	message: function (message, room) {
		var spl = message.split('|');
		switch (spl[1]) {
			case 'challstr':
				info('received challstr, logging in...');
				var id = spl[2];
				var str = spl[3];

				var requestOptions = {
					hostname: this.actionUrl.hostname,
					port: this.actionUrl.port,
					path: this.actionUrl.pathname,
					agent: false
				};

				var data;
				if (!Config.pass) {
					requestOptions.method = 'GET';
					requestOptions.path += '?act=getassertion&userid=' + toId(Config.nick) + '&challengekeyid=' + id + '&challenge=' + str;
				} else {
					requestOptions.method = 'POST';
					data = 'act=login&name=' + Config.nick + '&pass=' + Config.pass + '&challengekeyid=' + id + '&challenge=' + str;
					requestOptions.headers = {
						'Content-Type': 'application/x-www-form-urlencoded',
						'Content-Length': data.length
					};
				}
				var req = https.request(requestOptions, function (res) {
					res.setEncoding('utf8');
					var data = '';
					res.on('data', function (chunk) {
						data += chunk;
					});
					res.on('end', function () {
						if (data === ';') {
							error('failed to log in; nick is registered - invalid or no password given');
							process.exit(-1);
						}
						if (data.length < 50) {
							error('failed to log in: ' + data);
							process.exit(-1);
						}

						if (data.indexOf('heavy load') !== -1) {
							error('the login server is under heavy load; trying again in one minute');
							setTimeout(function () {
								this.message(message);
							}.bind(this), 60 * 1000);
							return;
						}

						if (data.substr(0, 16) === '<!DOCTYPE html>') {
							error('Connection error 522; trying agian in one minute');
							setTimeout(function () {
								this.message(message);
							}.bind(this), 60 * 1000);
							return;
						}

						try {
							data = JSON.parse(data.substr(1));
							if (data.actionsuccess) {
								data = data.assertion;
							} else {
								error('could not log in; action was not successful: ' + JSON.stringify(data));
								process.exit(-1);
							}
						} catch (e) {}
						send('|/trn ' + Config.nick + ',0,' + data);
					}.bind(this));
				}.bind(this));

				req.on('error', function (err) {
					error('login error: ' + err.stack);
				});

				if (data) req.write(data);
				req.end();
				break;
		     case 'html':
		        if (room && room.game && typeof room.game.handlehtml === 'function') {
					room.game.handlehtml(spl[2]);
				}
				break;
			case 'battle':
				Battles.handleMessage(splitMessage.join("|"));
			case 'updateuser':
				if (spl[2] !== Config.nick) return;

				if (spl[3] !== '1') {
					error('failed to log in, still guest');
					process.exit(-1);
				}

				ok('logged in as ' + spl[2]);
				send('|/blockchallenges');

				// Now join the rooms
				Rooms.join();

				break;
			case 'c':
				var username = spl[2];
				var user = Users.get(username);
				if (!user) return false; // various "chat" responses contain other data
				if (user === Users.self) return false;
				spl = spl.slice(3).join('|');
				if (!user.hasRank(room.id, '%')) this.processChatData(user.id, room.id, spl);
				this.chatMessage(spl, user, room);
				break;
			case 'c:':
				var username = spl[3];
				var user = Users.get(username);
				if (!user) return false; // various "chat" responses contain other data
				if (user === Users.self) return false;
				spl = spl.slice(4).join('|');
				if (!user.hasRank(room.id, '%')) this.processChatData(user.id, room.id, spl);
				this.chatMessage(spl, user, room);
				break;
			case 'popup':
				var stuff = spl.slice();
				stuff.splice(0,2);
				var thing = stuff.join("|").split('||||');
				Config.canHost = [];
				for (let i = 0; i < thing.length; i++) {
					let names = thing[i].split("||");
					if (names[0].indexOf('+') === -1) continue;
					let realnames = names[1].split(",");
					for (let j = 0; j < realnames.length; j++) {
						Config.canHost.push(Tools.toId(realnames[j]));
					}
				}
			case 'pm':
				var username = spl[2];
				var user = Users.get(username);
				var group = username.charAt(0);
				if (!user) user = Users.add(username);
				//if (user === Users.self) return false;

				spl = spl.slice(4).join('|');
				if (spl.startsWith('/invite ') && !(toId(spl.substr(8)) === 'lobby')) {
					if (toId(spl.substr(8)).startsWith('battlegen7anythinggoes') || user.isExcepted()) {
						return send('|/join ' + spl.substr(8));
					}
				}
				this.chatMessage(spl, user, user);
				break;
			case 'N': case 'n':
				var username = spl[2];
				var oldid = spl[3];
				var user = room.onRename(username, oldid);
				this.updateSeen(oldid, spl[1], user.id);
				break;
			case 'J': case 'j':
				var username = spl[2];
				var user = room.onJoin(username, username.charAt(0));
				if (user === Users.self) return false;
				this.updateSeen(user.id, spl[1], room.id);
				break;
			case 'l': case 'L':
				var username = spl[2];
				var user = room.onLeave(username);
				if (user) {
					if (user === Users.self) return false;
					this.updateSeen(user.id, spl[1], room.id);
				} else {
					this.updateSeen(toId(username), spl[1], room.id);
				}
				break;
		}
	},
	chatMessage: function (message, user, room) {
		if (!room) return;
		if (message.substr(0, Config.commandcharacter.length) !== Config.commandcharacter) return false;
		message = message.substr(Config.commandcharacter.length);
		var index = message.indexOf(' ');
		var arg = '';
		var cmd = message;
		if (index > -1) {
			cmd = cmd.substr(0, index);
			arg = message.substr(index + 1).trim();
		}
		cmd = Tools.toId(cmd);
		if (!!Commands[cmd]) {
			let failsafe = 0;
			while (typeof Commands[cmd] !== "function" && failsafe++ < 10) {
				cmd = Commands[cmd];
			}
			if (typeof Commands[cmd] === "function") {
				try {
					Commands[cmd].call(this, arg, user, room);
					user.lastcmd = cmd;
				} catch (e) {
					let stack = e.stack;
					stack += 'Additional information:\n';
					stack += 'Command = ' + cmd + '\n';
					stack += 'Target = ' + arg + '\n';
					stack += 'Time = ' + new Date(this.time).toLocaleString() + '\n';
					stack += 'User = ' + user.name + '\n';
					stack += 'Room = ' + (room.id === user.id ? 'in PM' : room.id);
					console.log(stack);
				}
			} else {
				error("invalid command type for " + cmd + ": " + (typeof Commands[cmd]));
			}
		}
	},
	say: function (target, text) {
		if (!target) return;
		var targetId = target.id;
		if (Rooms.get(targetId)) {
			send((targetId !== 'lobby' ? targetId : '') + '|' + text);
			send((targetId !== 'lobby' ? targetId : '') + '|/asdf');
		} else {
			send('|/pm ' + targetId + ', ' + text);
			send('|/pm ' + targetId + ',/asdf');
		}
	},
	uncacheTree: function (root) {
		var uncache = [require.resolve(root)];
		do {
			let newuncache = [];
			for (let i of uncache) {
				if (require.cache[i]) {
					newuncache.push.apply(newuncache,
						require.cache[i].children.map(function (module) {
							return module.filename;
						})
					);
					delete require.cache[i];
				}
			}
			uncache = newuncache;
		} while (uncache.length);
	},
};
