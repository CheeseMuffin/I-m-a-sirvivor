/**
 * Storage
 * Cassius - https://github.com/sirDonovan/Cassius
 *
 * This file handles the storage of room databases
 *
 * @license MIT license
 */

'use strict';

const fs = require('fs');
const BACKUP_INTERVAL = 60 * 60 * 1000;

const CUSTOMS_FILE = "./databases/customs.json";
const CUSTOM_ALIASES_FILE = "./databases/custom-aliases.json";
const QUOTES_FILE = "./databases/quotes.json";
const TRIVIA_FILE = "./databases/trivia.json";

class Customs {
	constructor() {
        this.customs = {};
        this.deletedCustoms = [];
        this.customAliases = {};
        this.quotes = {};
        this.trivia = {};
    }

    exportDatabases() {
        this.exportDatabaseToFile(this.customs, CUSTOMS_FILE);
        this.exportDatabaseToFile(this.customAliases, CUSTOM_ALIASES_FILE);
        this.exportDatabaseToFile(this.quotes, QUOTES_FILE);
        this.exportDatabaseToFile(this.trivia, TRIVIA_FILE);
    }

    exportDatabaseToFile(database, fileName) {
        fs.writeFileSync(fileName, JSON.stringify(database));
    }

    importDatabases() {
        // Custom Commands
        let file = '{}';
        try {
            file = fs.readFileSync(CUSTOMS_FILE).toString();
        } catch (e) {}
        this.customs = JSON.parse(file);
        file = '{}';
        try {
            file = fs.readFileSync(CUSTOM_ALIASES_FILE).toString();
        } catch (e) {}
        this.customAliases = JSON.parse(file);

        // Quotes
        file = '{}';
        try {
            file = fs.readFileSync(QUOTES_FILE).toString();
        } catch (e) {}
        this.quotes = JSON.parse(file);
        this.updateCommands();

        // Trivia
        file = '{}'
        try {
            file = fs.readFileSync(TRIVIA_FILE).toString();
        } catch (e) {};
        this.trivia = JSON.parse(file);
    }

    addTriviaQuestion(target, room) {
        let split = target.split("|");
        if (split.length !== 2) {
            return room.say("You must specify a question and an answer, in the form: ``Question|Answer``");
        }
        let question = split[0].trim();
        let answer = split[1].trim();
        this.trivia[Tools.toId(question)] = {
            question: question,
            answer: answer,
        };
        this.exportDatabaseToFile(this.trivia, TRIVIA_FILE);
        room.say("Question successfully added.");
    }

    removeTriviaQuestion(target, room) {
        let questionid = Tools.toId(target);
        if (!(questionid in this.trivia)) {
            return room.say("No question matching **" + target + "** was found.");
        }
        delete this.trivia[questionid];
        this.exportDatabaseToFile(this.trivia, TRIVIA_FILE);
        room.say("Question successfully deleted.");
    }

    updateCommands() {
        for (let name in this.customs) {
            if (name in Commands) {
                delete Commands[name];
            }
            let response = this.customs[name];
            Commands[name] = function (target, user, room) {
                room.say(response);
            }
        }

        for (let custom of this.deletedCustoms) {
            if (custom in Commands) {
                delete Commands[custom];
            }
        }

        for (let alias in this.customAliases) {
            if (alias in Commands) {
                delete Commands[alias];
            }
            Commands[alias] = this.customAliases[alias];
        }
    }

    parse(text) {
        let splitText = text.split(",");
        if (splitText.length < 2) {
            return "You must specify a command and the corresponding text";
        }
        let commandText = splitText.slice(1).join(",").trim();
        if (commandText.length == 0) {
            return "You must specify the command corresponding to **" + splitText[0] + "**.";
        }
        return [Tools.toId(splitText[0]), splitText.slice(1).join(",").trim()];
    }

    addCustom(textArray) {
        this.customs[textArray[0]] = textArray[1];
        this.updateCommands();
        this.exportDatabases();
    }

    removeCustom(text, room) {
        let id = Tools.toId(text);
        if (!(id in this.customs || id in this.customAliases)) {
            return room.say("No custom matching **" + text + "** was found");
        }

        if (id in this.customs) delete this.customs[id];
        if (id in this.customAliases) delete this.customAliases[id];
        this.deletedCustoms.push(id);
        this.updateCommands();
        this.exportDatabases();
        room.say("Custom command successfully removed.");
    }

    addCustomAlias(textArray) {
        this.customAliases[textArray[0]] = Tools.toId(textArray[1]);
        this.updateCommands();
        this.exportDatabases();
    }

    addQuote(phrase, room) {
        if (!phrase) return 'Usage: ``.quote [quote]``';
        this.quotes[Tools.toId(phrase)] = phrase.trim();
        this.exportDatabases();
        return room.say("Quote added");
    }

    removeQuote(phrase, room) {
        if (!phrase) return 'Usage: ``.removequote [quote]``';
        let id = Tools.toId(phrase);
        if (!(id in this.quotes)) {
            return room.say("There is no quote matching __" + phrase + "__");
        }
        delete this.quotes[id];
        this.exportDatabases();
        return room.say("Quote deleted.");
    }

    sayRandomQuote(room) {
        let id = Tools.sampleOne(Object.keys(this.quotes));
        room.say("__" + this.quotes[id] + "__");
    }

    listQuotes(room) {
        let text = Object.values(this.quotes).join("\n");
        Tools.uploadToHastebin(text, (success, link) => {
			if (success) room.say(link);
            else user.say('Error connecting to hastebin.');
        });
    }
}

module.exports = new Customs();
