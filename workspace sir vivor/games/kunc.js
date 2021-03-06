'use strict';

const name = "KUNC";
const kuncSets = require('../data/kunc-sets.json');

class Kunc extends Games.Game {
    constructor(room) {
        super(room);
        this.freeJoin = true;
        this.answers = [];
        this.timeout = null;
        this.points = new Map();
        this.maxPoints = 5;
    }

    onSignups() {
        this.started = true;
        this.timeout = setTimeout(() => this.nextRound(), 10 * 1000);
    }

    setAnswers() {
        let set = Tools.sampleOne(kuncSets);
        this.answers = [set[0]];
        this.hint = "__" + set[1].map(arr => arr[0]).join(", ") + "__";
    }

    onNextRound() {
        if (this.answers.length) {
            this.say("Time's up! The answer was: __" + this.answers[0] + "__");
        }
        this.setAnswers();
        this.say(this.hint);
        this.timeout = setTimeout(() => this.nextRound(), 10 * 1000);
    }

    checkAnswer(guess) {
		if (!this.answers) return;
		for (let i = 0, len = this.answers.length; i < len; i++) {
			if (Tools.toId(this.answers[i]) === guess) {
				return true;
			}
		}
		return false;
	}

    guess(guess, user) {
		if (!this.answers || !this.answers.length || !this.points || !this.maxPoints || !this.started || (user.id in this.players && this.players[user.id].eliminated)) return;
		if (!(user.id in this.players)) this.addPlayer(user);
		let player = this.players[user.id];
		guess = Tools.toId(guess);
        if (!guess) return;
		if (this.filterGuess && this.filterGuess(guess)) return;
		if (this.roundGuesses) {
			if (this.roundGuesses.has(player)) return;
			this.roundGuesses.set(player, true);
        }
		if (!this.checkAnswer(guess)) {
			if (this.onGuess) this.onGuess(guess, player);
			return;
        }
		if (this.timeout) clearTimeout(this.timeout);
		let points = this.points.get(player) || 0;
		if (this.pointsPerAnswer) {
			points += this.pointsPerAnswer(guess);
		} else {
			points += 1;
		}
		this.points.set(player, points);
		if (points >= this.maxPoints) {
			this.winners.set(player, points);
			this.say("Correct! " + user.name + " wins the game! (Answer" + (this.answers.length > 1 ? "s" : "") + ": __" + this.answers.join(", ") + "__)");
			this.end();
			return;
		}
		this.say("Correct! " + user.name + " advances to " + points + " point" + (points > 1 ? "s" : "") + ". (Answer" + (this.answers.length > 1 ? "s" : "") + ": __" + this.answers.join(", ") + "__)");
		this.answers = [];
		this.timeout = setTimeout(() => this.nextRound(), 5 * 1000);
	}
}

exports.game = Kunc;
exports.name = name;
exports.id = Tools.toId(name);
exports.commands = {
    "guess": "guess",
    "g": "guess",
};