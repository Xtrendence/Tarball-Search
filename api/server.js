const express = require("express");
const app = express();
const port = 970;
const server = app.listen(port);

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const url = require("url");
const readline = require("readline");
const body_parser = require("body-parser");

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

let activeSearches = {};
let cancelled = false;

if(!fs.existsSync(outputDirectory)) {
	fs.mkdirSync(outputDirectory);
}

if(!fs.existsSync(pinFile)) {
	fs.writeFileSync(pinFile, "");
}

app.post("/search", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	if(await verifyPin(req.body.pin)) {
		let ip = getIP();
		let id = epoch();

		try {
			if(!empty(req.body.files)) {
				let valid = true;
				req.body.files.map((file) => {
					if(!fs.existsSync(file)) {
						valid = false;
					}
				});
				if(valid) {
					readFiles(id, req.body.files, 0, req.body.query);
				}
			} else {
				readFiles(id, findByExt(filesDirectory, "tar.gz"), 0, req.body.query);
			}

			res.json({ 
				message:"Searching...", 
				id:id, 
				output:"http://" + ip + ":" + port + "/output?id=" + id + "&pin=" + req.body.pin,
				cancel:"http://" + ip + ":" + port + "/cancel?id=" + id + "&pin=" + req.body.pin
			});
		} catch(e) {
			console.log(e);
		}
	} else {
		res.statusCode = 401;
		res.json({ error:"Access not authorized." });
	}
});

app.get("/cancel", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	let queries = url.parse(req.url, true).query;
	if(await verifyPin(queries.pin)) {
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
});

app.get("/files", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	let queries = url.parse(req.url, true).query;
	if(await verifyPin(queries.pin)) {
		try {
			let files = findByExt(filesDirectory, "tar.gz");
			if(files.length === 0) {
				res.json({ error:"No files found." });
			} else {
				res.json({ files:files });
			}
		} catch(e) {
			console.log(e);
		}
	} else {
		res.statusCode = 401;
		res.json({ error:"Access not authorized." });
	}
});

app.get("/output", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	let queries = url.parse(req.url, true).query;
	if(await verifyPin(queries.pin)) {
		if(!empty(queries.id)) {
			let content = await getOutput(queries.id.toString());
			if(!content) {
				res.json({ error:"File not found." });
			} else {
				res.setHeader("Content-Type", "text/plain");
				res.end(content);
			}
		} else {
			let response = {};
			let files = fs.readdirSync(outputDirectory);
			files.map((id) => {
				let stats = fs.statSync(outputDirectory + id);
				let size = humanFileSize(stats.size);
				let time = formatDate(new Date(id * 1000));
				response[id] = { url:"http://" + getIP() + ":" + port + "/output?id=" + id + "&pin=" + queries.pin, size:size, time:time };
			});
			res.json(response);
		}		
	} else {
		res.statusCode = 401;
		res.json({ error:"Access not authorized." });
	}
});

app.delete("/output", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	if(await verifyPin(req.body.pin)) {
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
});

app.get("/shutdown", async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	let queries = url.parse(req.url, true).query;
	if(await verifyPin(queries.pin)) {
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
});

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

String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
};

function empty(string) {
	if(string != null && typeof string != "undefined" && string.toString().trim() != "" && JSON.stringify(string) != "" && JSON.stringify(string) != "{}") {
		return false;
	}
	return true;
}