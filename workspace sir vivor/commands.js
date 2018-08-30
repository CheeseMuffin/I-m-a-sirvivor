/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

 // spreadsheet key is the long id in the sheets URL 

var http = require('http');
var cb = require('origindb')('lb');
var _ = require('lodash');;
 
let millisToTime = function(millis){
	let seconds = millis/1000;
	let hours = Math.floor(seconds/3600);
	let minutes = Math.floor((seconds-hours*3600)/60);
	let response;
	if(hours>0){
		response = hours + " hour" + (hours === 1 ? "" : "s") + " and " + minutes + " minute" + (minutes === 1 ? "" : "s");
	}else{
		response = minutes + " minute" + (minutes === 1 ? "" : "s");
	}
	return response;
};
if (Config.serverid === 'showdown')
{
	var https = require('https');
}

var host = '';
var hostId = '';

exports.commands = {
	/**
	 * Help commands
	 *
	 * These commands are here to provide information about the bot.
	 */

	js: function(arg, user, room)
	{
		if (!user.isExcepted()) return false;
		try
		{
			let result = eval(arg.trim());
			this.say(room, JSON.stringify(result));
		}
		catch (e)
		{
			this.say(room, e.name + ": " + e.message);
		}
	},

	addcustom: function (target, user, room) {
		if (!user.hasRank('dreamyard', '#')) return;
		let resp = Customs.parse(target);
		if (typeof resp == 'string') {
			room.say(resp);
			return;
		} 
		Customs.addCustom(resp);
		room.say("A custom command has been added for **" + resp[0] + "**.");
	},

	rmcustom: function (target, user, room) {
		if (!user.hasRank('dreamyard', '#')) return;
		Customs.removeCustom(target, room);
	},
	
	addtrivia: function (target, user, room) {
		if (!user.hasRank('dreamyard', '#')) return;
		Customs.addTriviaQuestion(target, room);
	},

	removetrivia: 'rmtrivia',
	rmtrivia: function (target, user, room) {
		if (!user.hasRank('dreamyard', '#')) return;
		Customs.removeTriviaQuestion(target, room);
	},

	addcustomalias: function (target, user, room) {
		if (!user.hasRank('dreamyard', '#')) return;
		let resp = Customs.parse(target);
		if (typeof resp == 'string') {
			room.say(resp);
			return;
		} 
		Customs.addCustomAlias(resp);
		room.say("A custom alias has been added for **" + resp[0] + "**.");
	},

	quote: 'addquote',
	addquote: function (target, user, room) {
		if (!user.hasRank('dreamyard', '@')) return;
		Customs.addQuote(target, room);
	},

	listquotes: 'quotes',
	quotes: function (target, user, room) {
		if (!user.hasRank('dreamyard', '%')) return;
		Customs.listQuotes(room);
	},

	deletequote: 'removequote',
	delquote: 'removequote',
	removequote: function (target, user, room) {
		if (!user.hasRank('dreamyard', '@')) return;
		Customs.removeQuote(target, room);
	},

	randomquote: 'randquote',
	randquote: function (target, user, room) {
		if (!user.hasRank('dreamyard', '%')) return;
		Customs.sayRandomQuote(room);
	},

	autostart: function (target, user, room) {
		if (!user.hasRank(room.id, '+')) return;
		if (room.game && typeof room.game.autostart === 'function') room.game.autostart(target);
	},

	dq: function (target, user, room) {
		if (!user.hasRank(room.id, '+')) return;
		if (room.game && typeof room.game.dq === 'function') room.game.dq(target);
	},

	pl: 'players',
	players: function (target, user, room) {
		if (!user.hasRank(room.id, '%') && (Config.canHost.indexOf(user.id) === -1)) return;
		if (room.game && typeof room.game.pl === 'function') room.game.pl();
	},

    signups: function (target, user, room) {
		if (!user.hasRank(room.id, '+')) return;
		if (room.game) return room.say("A game of " + room.game.name + " is in progress.");
		let id = Tools.toId(target);
		if (!Games.createGame(target, room)) return;
		room.game.signups();
	},

	randgame: "randomgame",
	randomgame: function (arg, user, room) {
	    if (!user.hasRank(room.id, '+')) return;
		if (room.game) return room.say("A game of " + room.game.name + " is in progress.");
		let goodids = Object.keys(Games.games).slice();
		goodids = goodids.concat(Object.keys(Games.aliases));
		let id = Tools.sample(goodids);
		Games.createGame(id, room);
		while (room.game.baseId === Games.lastGame) {
			id = Tools.sample(goodids);
			Games.createGame(id, room);
		}
		room.game.signups();
	},

	endgame: 'end',
	end: function (target, user, room) {
		if (!user.hasRank(room.id, '+')) return;
		if (!room.game) return;
		room.game.forceEnd();
	},

	startgame: 'start',
    start: function (target, user, room) {
	    if (!user.hasRank(room.id, '+') || !room.game) return;
	    if (typeof room.game.start === 'function') room.game.start();
    },
};

/* globals toId */
