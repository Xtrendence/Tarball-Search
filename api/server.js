const express = require("express");
const app = express();
const port = 970;
const server = app.listen(port);

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const cors = require("cors");
const base64 = require("base-64");
const bcrypt = require("bcryptjs");
const url = require("url");
const readline = require("readline");
const body_parser = require("body-parser");

const RSA = require('hybrid-crypto-js').RSA;
const Crypt = require('hybrid-crypto-js').Crypt;

const spawn = require("child_process").spawn;
const exec = require("child_process").exec;

app.set("json spaces", 4);
app.use(cors());
app.use(body_parser.urlencoded({ extended: true }));
app.use(body_parser.json());

process.setMaxListeners(0);

const filesDirectory = path.join(__dirname, "../");
const outputDirectory = path.join(__dirname, "./output/");
const pinFile = path.join(__dirname, "./config/pin.txt");
const publicKeyFile = path.join(__dirname, "./config/public.txt");
const privateKeyFile = path.join(__dirname, "./config/private.txt");

let keySize = 4096;
let activeSearches = {};
let cancelled = false;
let publicKey;
let privateKey;

if(!fs.existsSync(outputDirectory)) {
	fs.mkdirSync(outputDirectory);
}

if(!fs.existsSync(pinFile)) {
	fs.writeFileSync(pinFile, "");
}

getKeys().then(() => {
	start();
}).catch(() => {
	console.log("Couldn't generate or get RSA key pair.");
});

function start() {
	app.delete("/key", async (req, res) => {
		res.setHeader("Content-Type", "application/json");
		try {
			let encryptedPin = base64.decode((req.body.pin));
			let pin = decrypt(privateKey, encryptedPin).message;
			if(await verifyPin(pin)) {
				fs.unlinkSync(publicKeyFile);
				fs.unlinkSync(privateKeyFile);
				getKeys().then(() => {
					res.json({ message:"Server keys have been regenerated." });
				}).catch(() => {
					res.json({ error:"Server keys couldn't be regenerated." });
				});
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.get("/key", async (req, res) => {
		res.setHeader("Content-Type", "text/plain");

		getKeys().then(() => {
			res.end(publicKey);
		}).catch(() => {
			res.end("Couldn't generate or get the server's RSA key.");
		});
	});

	app.post("/search", async (req, res) => {
		res.setHeader("Content-Type", "application/json");

		try {
			let encryptedPin = base64.decode((req.body.pin));
			let pin = decrypt(privateKey, encryptedPin).message;

			if(await verifyPin(pin)) {
				if(!empty(req.body.query)) {
					let ip = getIP();
					let id = epoch();

					try {
						let query = decrypt(privateKey, base64.decode(req.body.query)).message;

						if(!empty(query)) {
							if(!empty(req.body.files)) {
								let files = JSON.parse(decrypt(privateKey, base64.decode(req.body.files)).message);
								let valid = true;
								files.map((file) => {
									if(!fs.existsSync(file)) {
										valid = false;
									}
								});
								if(valid) {
									readFiles(id, files, 0, query);
								}
							} else {
								readFiles(id, findByExt(filesDirectory, "tar.gz"), 0, query);
							}

							let response = {
								message:"Searching...", 
								id:id,
								output:"http://" + ip + ":" + port + "/output?id=" + id + "&pin=" + req.body.pin + "&publicKey=" + req.body.publicKey,
								cancel:"http://" + ip + ":" + port + "/cancel?id=" + id + "&pin=" + req.body.pin + "&publicKey=" + req.body.publicKey
							};

							let queryKey = base64.decode(req.body.publicKey);
							let json = JSON.stringify(response);
							res.json({ response:base64.encode(encrypt(queryKey, json)) });
						} else {
							res.json({ error:"No search query entered." });
						}
					} catch(e) {
						console.log(e);
					}
				} else {
					res.json({ error:"No search query entered." });
				}
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.get("/cancel", async (req, res) => {
		res.setHeader("Content-Type", "application/json");
		let queries = url.parse(req.url, true).query;

		try {
			let encryptedPin = base64.decode((queries.pin));
			let pin = decrypt(privateKey, encryptedPin).message;

			if(await verifyPin(pin)) {
				if(Object.keys(activeSearches).includes(queries.id.toString())) {
					cancelled = true;
					activeSearches[queries.id.toString()].close();
					delete activeSearches[queries.id.toString()];
					res.json({ message:"The search has been cancelled." });
				} else {
					res.json({ error:"No search found with that ID." });
				}
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.get("/files", async (req, res) => {
		res.setHeader("Content-Type", "application/json");
		let queries = url.parse(req.url, true).query;

		try {
			let queryKey = base64.decode((queries.publicKey));
			let encryptedPin = base64.decode((queries.pin));
			let pin = decrypt(privateKey, encryptedPin).message;

			if(await verifyPin(pin)) {
				try {
					let files = findByExt(filesDirectory, "tar.gz");
					if(files.length === 0) {
						res.json({ error:"No files found." });
					} else {
						let response = base64.encode(encrypt(queryKey, JSON.stringify(files)));
						res.json({ response:response });
					}
				} catch(e) {
					console.log(e);
				}
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.get("/output", async (req, res) => {
		res.setHeader("Content-Type", "application/json");
		let queries = url.parse(req.url, true).query;

		try {
			let encryptedPin = base64.decode((queries.pin));
			let queryKey = base64.decode(queries.publicKey);
			let pin = decrypt(privateKey, encryptedPin).message;
			if(await verifyPin(pin)) {
				if(!empty(queries.id)) {
					let content = await getOutput(queries.id.toString());
					if(!content) {
						res.json({ error:"File not found." });
					} else {
						res.setHeader("Content-Type", "text/plain");
						res.end(base64.encode(encrypt(queryKey, content)));
					}
				} else {
					let response = {};
					let files = fs.readdirSync(outputDirectory);
					files.map((id) => {
						let stats = fs.statSync(outputDirectory + id);
						let size = humanFileSize(stats.size);
						let time = formatDate(new Date(id * 1000));
						response[id] = { url:"http://" + getIP() + ":" + port + "/output?id=" + id + "&pin=" + queries.pin + "&publicKey=" + queries.publicKey, size:size, time:time };
					});

					let json = JSON.stringify(response);
					res.json({ response:base64.encode(encrypt(queryKey, json)) });
				}		
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.delete("/output", async (req, res) => {
		res.setHeader("Content-Type", "application/json");

		try {
			let encryptedPin = base64.decode((req.body.pin));
			let pin = decrypt(privateKey, encryptedPin).message;

			if(await verifyPin(pin)) {
				try {
					if(await deleteFile(req.body.id.toString())) {
						res.json({ message:"The file has been deleted." });
					} else {
						res.json({ error:"The file couldn't be deleted." });
					}
				} catch(e) {
					console.log(e);
				}
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});

	app.get("/shutdown", async (req, res) => {
		res.setHeader("Content-Type", "application/json");
		let queries = url.parse(req.url, true).query;

		try {
			let encryptedPin = base64.decode((queries.pin));
			let pin = decrypt(privateKey, encryptedPin).message;

			if(await verifyPin(pin)) {
				try {
					exec("shutdown /s");
					res.json({ message:"Shutting down." });
				} catch(e) {
					console.log(e);
				}
			} else {
				res.statusCode = 401;
				res.json({ error:"Access not authorized." });
			}
		} catch(e) {
			console.log(e);
			res.json({ error:"Couldn't verify the provided PIN." });
		}
	});
}

function getKeys() {
	return new Promise((resolve, reject) => {
		if(!fs.existsSync(publicKeyFile) || !fs.existsSync(privateKeyFile)) {
			let rsa = new RSA({ keySize:keySize });
			rsa.generateKeyPair(keyPair => {
				if(!empty(keyPair.publicKey) && !empty(keyPair.privateKey)) {
					fs.writeFileSync(publicKeyFile, keyPair.publicKey);
					fs.writeFileSync(privateKeyFile, keyPair.privateKey);
					publicKey = keyPair.publicKey;
					privateKey = keyPair.privateKey;
					resolve();
				} else {
					reject();
				}
			});
		} else {
			publicKey = fs.readFileSync(publicKeyFile, { encoding:"utf-8" });
			privateKey = fs.readFileSync(privateKeyFile, { encoding:"utf-8" });
			if(!empty(publicKey) && !empty(privateKey)) {
				resolve();
			} else {
				reject();
			}
		}
	});
}

async function deleteFile(id) {
	let file = outputDirectory + id;
	fs.unlinkSync(file);
	if(fs.existsSync(file)) {
		return false;
	}
	return true;
}

function readFiles(id, files, index, searchQuery) {
	id = id.toString();
	fs.readdir(outputDirectory, function(error, data) {
		if(error) {
			console.log(error);
		}
		else {
			let firstLine = true;
			let matches = 0;
			let outputFile = outputDirectory + id;
			let query = searchQuery.toString().toLowerCase().replaceAll("|", ",");
			let queries = query.split(",");

			activeSearches[id] = readline.createInterface({
				input: fs.createReadStream(files[index]).pipe(zlib.createGunzip())
			});

			activeSearches[id].on("line", function(line) {
				if(Object.keys(activeSearches).includes(id)) {
					if(firstLine) {
						if(index === 0) {
							saveOutput("----- Begin Search Query -----\n");
							saveOutput(searchQuery);
							saveOutput("\n----- End Search Query -----\n");
						}
						saveOutput("----- Start Of: " + files[index] + " -----\n");
						firstLine = false;
					}
					for(let i = 0; i < queries.length; i++) {
						if(queries[i].charAt(0) === "^") {
							if(line.toLowerCase().startsWith(queries[i].trim().substring(1))) {
								saveOutput(line);
								matches += 1;
							}
						} else {
							if(line.toLowerCase().includes(queries[i].trim())) {
								saveOutput(line);
								matches += 1;
							}
						}
					}
				}
			});

			activeSearches[id].on("close", function() {
				if(cancelled) {
					saveOutput("\n----- Search Cancelled (" + matches + " Matches) -----");
				} else {
					saveOutput("\n----- End Of: " + files[index] + " (" + matches + " Matches) -----\n");
					if(files.length - 1 > index) {
						readFiles(id, files, index + 1, searchQuery);
					} else {
						saveOutput("----- End Of Search -----");
						activeSearches[id].close();
						delete activeSearches[id];
					}
				}
			});

			function saveOutput(line) {
				if(fs.existsSync(outputFile) || (firstLine && index === 0)) {
					fs.appendFileSync(outputFile, line + "\n", function(error) {
						if(error) {
							console.log(error);
						}
						else {
							if(fs.statSync(outputFile).size >= 50000000) {
								outputFile = outputDirectory + epoch() + ".txt";
								fs.writeFileSync(outputFile, "", function(error) {
									if(error) {
										console.log(error);
									}
								});
							}
						}
					});
				} else {
					activeSearches[id].close();
					delete activeSearches[id];
				}
			}
		}
	});
}

async function getOutput(id) {
	let file = outputDirectory + id;
	if(fs.existsSync(file)) {
		return fs.readFileSync(file, { encoding:"utf-8" });
	}
	return false;
}

function findByExt(dir, ext, files, result) {
	files = files || fs.readdirSync(dir);
	result = result || {};

	files.forEach(function(file) {
		let newbase = path.join(dir, file);
		if(fs.statSync(newbase).isDirectory() && !newbase.toString().includes("node_modules") && !newbase.toString().includes(path.basename(__dirname))) {
			result = findByExt(newbase, ext, fs.readdirSync(newbase), result);
		} else {
			if(file.substr(-1 * (ext.length+1)) === '.' + ext) {
				result[newbase] = humanFileSize(fs.statSync(newbase).size);
			}
		}
	});
	return result;
}

function encrypt(publicKey, plaintext) {
	let crypt = new Crypt({ aesStandard:"AES-CTR", aesKeySize:256 });
	return crypt.encrypt(publicKey, plaintext);
}

function decrypt(privateKey, encrypted) {
	let crypt = new Crypt({ aesStandard:"AES-CTR", aesKeySize:256 });
	return crypt.decrypt(privateKey, encrypted);
}

function humanFileSize(size) {
	let i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1000));
	return (size / Math.pow(1024, i)).toFixed(1) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
};

function formatDate(date) {
	return ("00" + (date.getMonth() + 1)).slice(-2) + " / " + ("00" + date.getDate()).slice(-2) + " / " + date.getFullYear() + " - " + ("00" + date.getHours()).slice(-2) + ":" + ("00" + date.getMinutes()).slice(-2) + ":" + ("00" + date.getSeconds()).slice(-2);
}

function getIP() {
	try {
		let interfaces = os.networkInterfaces();
		for(let i in interfaces) {
			for(let j in interfaces[i]) {
				let address = interfaces[i][j];
				if(address.family === "IPv4" && !address.internal && address.address.startsWith("192.168", 0)) {
					return address.address;
				}
			}
		}
	} catch(e) {
		console.log(e);
	}
}

function epoch() {
	var date = new Date();
	var time = Math.round(date.getTime() / 1000);
	return time;
}

async function verifyPin(pin) {
	if(!empty(pin)) {
		let validPin = fs.readFileSync(pinFile, { encoding:"utf-8" });
		return bcrypt.compare(pin, validPin);
	}
	return false;
}

function validJSON(json) {
	try {
		let object = JSON.parse(json);
		if(object && typeof object === "object") {
			return true;
		}
	}
	catch(e) { }
	return false;
}

String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
};

function empty(string) {
	if(string != null && typeof string != "undefined" && string.toString().trim() != "" && JSON.stringify(string) != "" && JSON.stringify(string) != "{}") {
		return false;
	}
	return true;
}