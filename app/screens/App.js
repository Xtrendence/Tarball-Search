import { setStatusBarBackgroundColor, StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import Constants from 'expo-constants';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Dimensions, ScrollView, Modal } from 'react-native';
import { Crypt, RSA } from 'hybrid-crypto-js';
import Wol from 'react-native-wol';
import FlashMessage, { showMessage, hideMessage } from 'react-native-flash-message';
import changeNavigationBarColor from 'react-native-navigation-bar-color';
import CardButton from '../components/CardButton';

let keySize = 1024;

const screenWidth = Dimensions.get("window").width;

changeNavigationBarColor("#141414");

export default function App() {
	const [config, setConfig] = React.useState("initial");

	const [loading, setLoading] = React.useState("Starting...");

	const [query, setQuery] = React.useState();
	const [cancel, setCancel] = React.useState(null);
	const [output, setOutput] = React.useState();

	const [changed, setChanged] = React.useState();
	const [allFiles, setAllFiles] = React.useState({});
	const [searchFiles, setSearchFiles] = React.useState({});
	const [filesList, setFilesList] = React.useState();

	const [historyList, setHistoryList] = React.useState();
	const [deleteModal, setDeleteModal] = React.useState(false);
	const [deleteID, setDeleteID] = React.useState();

	const [settingsMAC, setSettingsMAC] = React.useState();
	const [settingsIP, setSettingsIP] = React.useState();
	const [settingsPort, setSettingsPort] = React.useState();
	const [settingsPIN, setSettingsPIN] = React.useState();

	const [showPage, setShowPage] = React.useState("search");

	const scrollViewRef = React.useRef();

	useEffect(() => {
		setTimeout(() => {
			start();
		}, 500);
	}, []);

	useEffect(() => {
		let check = checkConfig(config);
		if(check === true) {
			getFiles();
			getHistory();

			AsyncStorage.getItem("selectedFiles").then((value) => { 
				if(value === null) {
					AsyncStorage.setItem("selectedFiles", 
						JSON.stringify(searchFiles)
					).then(() => {
						listFiles(allFiles);
					}).catch((error) => {
						console.log(error);
					});
				} 
			});
		} else {
			if(check !== "initial") {
				showMessage({
					message: check,
					type: "warning",
					backgroundColor: "rgb(240,135,35)"
				});
			}
		}
	}, [config]);

	useEffect(() => {
		if(showPage === "search" && !loading) {
			setTimeout(() => {
				scrollViewRef.current.scrollToEnd({ animated:true });
			}, 250);
		}
	}, [output]);

	useEffect(() => {
		try {
			if(searchFiles !== null) {
				let keys = Object.keys(searchFiles);
				if(keys.length > 0 || changed === "empty") {
					AsyncStorage.setItem("selectedFiles", 
						JSON.stringify(searchFiles)
					).then(() => {
						listFiles(allFiles);
					}).catch((error) => {
						console.log(error);
					});
				}
			}
		} catch(e) {
			console.log(e);
		}
	}, [changed]);

	return (
		<View style={styles.container}>
			<StatusBar style="light" backgroundColor={"rgb(20,20,20)"}></StatusBar>
			{ !empty(loading) &&
				<View style={styles.viewLoading}>
					<Text style={styles.textLoading}>{loading}</Text>
				</View>
			}
			{ empty(loading) &&
				<View style={styles.viewApp}>
					<View style={styles.topBar}>
						<View style={styles.topBarLeft}>
							<View style={styles.viewActions}>
								<TouchableOpacity onPress={() => { switchPage("search"); }} style={[styles.buttonAction, { backgroundColor:showPage === "search" ? "rgb(0,90,180)" : "rgb(0,150,255)" }]}>
									<Text style={styles.textAction}>Search</Text>
								</TouchableOpacity>
								<TouchableOpacity onPress={() => { switchPage("files"); }} style={[styles.buttonAction, { backgroundColor:showPage === "files" ? "rgb(0,90,180)" : "rgb(0,150,255)" }]}>
									<Text style={styles.textAction}>Files</Text>
								</TouchableOpacity>
								<TouchableOpacity onPress={() => { switchPage("history"); }} style={[styles.buttonAction, { backgroundColor:showPage === "history" ? "rgb(0,90,180)" : "rgb(0,150,255)" }]}>
									<Text style={styles.textAction}>History</Text>
								</TouchableOpacity>
							</View>
						</View>
						<View style={styles.topBarRight}>
							<TouchableOpacity onPress={() => { switchPage("settings"); }} style={[styles.buttonAction, { paddingLeft:6, paddingRight:6, backgroundColor:showPage === "settings" ? "rgb(0,90,180)" : "rgb(0,150,255)" }]}>
								<Svg width="32" height="32" fill={"rgb(255,255,255)"} viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><Path d="M1152 896q0-106-75-181t-181-75-181 75-75 181 75 181 181 75 181-75 75-181zm512-109v222q0 12-8 23t-20 13l-185 28q-19 54-39 91 35 50 107 138 10 12 10 25t-9 23q-27 37-99 108t-94 71q-12 0-26-9l-138-108q-44 23-91 38-16 136-29 186-7 28-36 28h-222q-14 0-24.5-8.5t-11.5-21.5l-28-184q-49-16-90-37l-141 107q-10 9-25 9-14 0-25-11-126-114-165-168-7-10-7-23 0-12 8-23 15-21 51-66.5t54-70.5q-27-50-41-99l-183-27q-13-2-21-12.5t-8-23.5v-222q0-12 8-23t19-13l186-28q14-46 39-92-40-57-107-138-10-12-10-24 0-10 9-23 26-36 98.5-107.5t94.5-71.5q13 0 26 10l138 107q44-23 91-38 16-136 29-186 7-28 36-28h222q14 0 24.5 8.5t11.5 21.5l28 184q49 16 90 37l142-107q9-9 24-9 13 0 25 10 129 119 165 170 7 8 7 22 0 12-8 23-15 21-51 66.5t-54 70.5q26 50 41 98l183 28q13 2 21 12.5t8 23.5z"/></Svg>
							</TouchableOpacity>
						</View>
					</View>
					{ showPage === "search" &&
						<View style={styles.viewPage}>
							<ScrollView style={styles.viewOutput} ref={scrollViewRef}>
								<Text style={styles.textOutput} selectable={true}>{output}</Text>
							</ScrollView>
							<View style={styles.viewSearch}>
								<TextInput onChangeText={(value) => { setQuery(value); }} placeholder="Search Query..." placeholderTextColor={"rgb(175,175,175)"} style={styles.inputSearch} multiline={true}>{query}</TextInput>
								<View style={styles.viewActions}>
									<TouchableOpacity onPress={() => { setOutput(); setQuery(); }} style={styles.buttonAction}>
										<Text style={styles.textAction}>Clear</Text>
									</TouchableOpacity>
									{ cancel !== null &&
										<TouchableOpacity onPress={() => { cancelSearch(cancel) }} style={styles.buttonAction}>
											<Text style={styles.textAction}>Cancel</Text>
										</TouchableOpacity>
									}
									<TouchableOpacity onPress={() => { search(query) }} style={styles.buttonAction}>
										<Text style={styles.textAction}>Search { empty(searchFiles) ? "0" : Object.keys(searchFiles).length} {empty(searchFiles) ? "File" : Object.keys(searchFiles).length === 1 ? "File" : "Files"}</Text>
									</TouchableOpacity>
								</View>
							</View>
						</View>
					}
					{ showPage === "files" &&
						<View style={styles.viewPage}>
							<ScrollView style={styles.viewScroll} contentContainerStyle={{ alignItems:"center", paddingBottom:20 }}>
								{filesList}
							</ScrollView>
							<View style={styles.viewFileActions}>
								<View style={styles.viewActions}>
									<TouchableOpacity onPress={() => { setSearchFiles({}); setChanged("empty"); }} style={styles.buttonAction}>
										<Text style={styles.textAction}>Deselect All</Text>
									</TouchableOpacity>
									<TouchableOpacity onPress={() => { setSearchFiles(allFiles); setChanged(new Date()); }} style={styles.buttonAction}>
										<Text style={styles.textAction}>Select All</Text>
									</TouchableOpacity>
								</View>
							</View>
						</View>
					}
					{ showPage === "history" &&
						<View style={styles.viewPage}>
							<ScrollView style={styles.viewScroll} contentContainerStyle={{ alignItems:"center", paddingBottom:20 }}>
								{historyList}
							</ScrollView>
							<Modal visible={deleteModal} animationType="fade" transparent={true}>
								<View style={styles.modalBackground}></View>
								<View style={styles.modalForeground}>
									<View style={styles.modalDelete}>
										<Text style={styles.modalText}>Are you sure you'd like to delete this file?</Text>
										<View style={styles.viewActions}>
											<TouchableOpacity onPress={() => { deleteAlert(null); }} style={styles.buttonAction}>
												<Text style={styles.textAction}>Cancel</Text>
											</TouchableOpacity>
											<TouchableOpacity onPress={() => { deleteHistory(deleteID); }} style={styles.buttonAction}>
												<Text style={styles.textAction}>Confirm</Text>
											</TouchableOpacity>
										</View>
									</View>
								</View>
							</Modal>
						</View>
					}
					{ showPage === "settings" &&
						<View style={styles.viewPage}>
							<ScrollView style={styles.viewScroll} contentContainerStyle={{ alignItems:"center", paddingBottom:20 }}>
								<TextInput onChangeText={(value) => { setSettingsMAC(value); }} placeholder="MAC..." placeholderTextColor={"rgb(175,175,175)"} style={[styles.inputSettings, { marginTop:60 }]} value={settingsMAC}></TextInput>
								<TextInput onChangeText={(value) => { setSettingsIP(value); }} placeholder="IP..." placeholderTextColor={"rgb(175,175,175)"} style={styles.inputSettings} value={settingsIP}></TextInput>
								<TextInput onChangeText={(value) => { setSettingsPort(value); }} placeholder="Port..." placeholderTextColor={"rgb(175,175,175)"} style={styles.inputSettings} value={settingsPort}></TextInput>
								<TextInput onChangeText={(value) => { setSettingsPIN(value); }} placeholder="PIN..." placeholderTextColor={"rgb(175,175,175)"} style={styles.inputSettings} value={settingsPIN} secureTextEntry={true}></TextInput>
								<View style={styles.viewActions}>
									<TouchableOpacity onPress={() => { saveSettings(); }} style={styles.buttonAction}>
										<Text style={styles.textAction}>Save Configuration</Text>
									</TouchableOpacity>
								</View>
								<View style={[styles.viewActions, { marginTop:20 }]}>
									<TouchableOpacity onPress={() => { regenerateKeys(); }} style={[styles.buttonAction, { marginTop:0, marginBottom:0 }]}>
										<Text style={styles.textAction}>Regenerate Keys</Text>
									</TouchableOpacity>
								</View>
								<View style={[styles.viewActions, { marginTop:20 }]}>
									<TouchableOpacity onPress={() => { awakenServer(); }} style={[styles.buttonAction, { backgroundColor:"rgb(50, 200, 75)" }]}>
										<Text style={styles.textAction}>Awaken Server</Text>
									</TouchableOpacity>
								</View>
								<View style={styles.viewActions}>
									<TouchableOpacity onPress={() => { shutdownServer(); }} style={[styles.buttonAction, { backgroundColor:"rgb(255, 50, 0)", marginTop:0 }]}>
										<Text style={styles.textAction}>Shutdown Server</Text>
									</TouchableOpacity>
								</View>
							</ScrollView>
						</View>
					}
				</View>
			}
			<FlashMessage position="bottom" floating={true} hideStatusBar={false} />
		</View>
	);

	async function regenerateKeys() {
		setLoading("Regenerating...");
		setTimeout(async () => {
			await AsyncStorage.removeItem("publicKey");
			await AsyncStorage.removeItem("privateKey");
			start();
		}, 1000);
	}

	async function start() {
		getKeys().then(async (keys) => {
			await AsyncStorage.setItem("publicKey", keys.publicKey);
			await AsyncStorage.setItem("privateKey", keys.privateKey);

			setLoading(null);

			getConfig().then((configuration) => {
				if(checkConfig(configuration) === true) {
					setConfig(configuration);
					setSettingsMAC(configuration["mac"]);
					setSettingsIP(configuration["ip"]);
					setSettingsPort(configuration["port"]);
					setSettingsPIN(configuration["pin"]);

					fetch(configuration["api"] + "/key", {
						method: "GET",
						headers: {
							Accept: "text/plain", "Content-Type": "text/plain"
						}
					})
					.then((text) => {
						return text.text();
					})
					.then(async (response) => {
						if(response.includes("Couldn't")) {
							showMessage({
								message: response,
								type: "danger",
								backgroundColor: "rgb(220,50,0)"
							});
						} else {
							if(response.includes("-----BEGIN PUBLIC KEY-----")) {
								await AsyncStorage.setItem("serverKey", response);
							} else {
								setTimeout(start, 5000);
								if(!empty(configuration["ip"] && !empty(configuration["port"]))) {
									showMessage({
										message: "Invalid server public key. Retrying...",
										type: "danger",
										backgroundColor: "rgb(220,50,0)"
									});
								}
							}
						}
					})
					.catch((error) => {
						console.log(error);
						if(!empty(configuration["ip"] && !empty(configuration["port"]))) {
							showMessage({
								message: "Network error. Retrying...",
								type: "warning",
								backgroundColor: "rgb(240,135,35)"
							});
						}
						setTimeout(start, 5000);
					});
				}
			}).catch((error) => {
				showMessage({
					message: "User configuration couldn't be fetched.",
					type: "danger",
					backgroundColor: "rgb(220,50,0)"
				});
			});
		}).catch(() => {
			setTimeout(start, 5000);
			showMessage({
				message: "Encryption keys couldn't be fetched. Retrying...",
				type: "danger",
				backgroundColor: "rgb(220,50,0)"
			});
		});
	}

	async function getKeys() {
		return new Promise(async (resolve, reject) => {
			let publicKey = await AsyncStorage.getItem("publicKey");
			let privateKey = await AsyncStorage.getItem("privateKey");

			if(empty(publicKey) || empty(privateKey)) {
				setLoading("Generating Keys...");
				
				setTimeout(async () => {
					let rsa = new RSA({ keySize:keySize });
					rsa.generateKeyPair(keyPair => {
						if(!empty(keyPair.publicKey) && !empty(keyPair.privateKey)) {
							resolve(keyPair);
						} else {
							reject();
						}				
					});
				}, 500);
			} else {
				resolve({ publicKey:publicKey, privateKey:privateKey });
			}
		});
	}

	async function search(searchQuery) {
		try {
			let selectedJSON = await AsyncStorage.getItem("selectedFiles");
			let selected = empty(selectedJSON) ? {} : JSON.parse(selectedJSON);
			let files = Object.keys(selected);

			if(!empty(files)) {
				fetch(config["api"] + "/search", {
					method: "POST",
					headers: {
						Accept: "application/json", "Content-Type": "application/json"
					},
					body: JSON.stringify({
						pin: config["pin"],
						query: searchQuery,
						files: files
					})
				})
				.then((json) => {
					return json.json();
				})
				.then(async (response) => {
					if("error" in response) {
						showMessage({
							message: response.error,
							type: "danger",
							backgroundColor: "rgb(220,50,0)"
						});
					} else {
						getOutput(response.output);
						setCancel(response.cancel);
					}
				})
				.catch((error) => {
					console.log(error);
					showMessage({
						message: "Network Error",
						type: "warning",
						backgroundColor: "rgb(240,135,35)"
					});
				});
			}
		} catch(e) {
			console.log(e);
		}
	}

	function cancelSearch(url) {
		fetch(url, {
			method: "GET",
			headers: {
				Accept: "text/plain", "Content-Type": "text/plain"
			}
		})
		.then((json) => {
			return json.json();
		})
		.then(async (response) => {
			if("error" in response) {
				showMessage({
					message: response.error,
					type: "danger",
					backgroundColor: "rgb(220,50,0)"
				});
			} else {
				setCancel(null);
				setOutput(response.message);
			}
		})
		.catch((error) => {
			console.log(error);
			showMessage({
				message: "Network Error",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		});
	}

	async function switchPage(page) {
		setShowPage(page);

		let configuration = await getConfig();
		setConfig(configuration);
		let check = checkConfig(configuration);

		if(page === "files") {
			if(check === true) {
				getFiles();
			} else {
				showMessage({
					message: check,
					type: "warning",
					backgroundColor: "rgb(240,135,35)"
				});
			}
		} else if(page === "history") {
			if(check === true) {
				getHistory();
			} else {
				showMessage({
					message: check,
					type: "warning",
					backgroundColor: "rgb(240,135,35)"
				});
			}
		} else if(page === "settings") {
			setSettingsMAC(configuration["mac"]);
			setSettingsIP(configuration["ip"]);
			setSettingsPort(configuration["port"]);
			setSettingsPIN(configuration["pin"]);
		}
	}

	async function getHistory() {
		fetch(config["api"] + "/output?pin=" + config["pin"], {
			method: "GET",
			headers: {
				Accept: "application/json", "Content-Type": "application/json"
			}
		})
		.then((json) => {
			return json.json();
		})
		.then(async (response) => {
			if(!empty(response)) {
				if("error" in response) {
					setHistoryList();
					showMessage({
						message: response.error,
						type: "danger",
						backgroundColor: "rgb(220,50,0)"
					});
				} else {
					let ids = Object.keys(response).reverse();
					setHistoryList(
						<View>
							{
								ids.map((id) => {
									let file = response[id];
									let size = file["size"];
									let url = file["url"];
									let time = file["time"];
									return (
										<CardButton key={id} onPress={() => { switchPage("search"); getOutput(url); }} onLongPress={() => { deleteAlert(id) }} backgroundColor={"rgb(30,30,30)"}>
											<Text style={styles.textCard}>{time}</Text>
											<Text style={[styles.textCard, { marginTop: 10 }]}>{id}</Text>
											<Text style={[styles.textCard, { marginTop:10, fontWeight:"bold" }]}>{size}</Text>
										</CardButton>
									);
								})
							}
						</View>
					);
				}
			} else {
				if(showPage === "history") {
					setHistoryList();
					showMessage({
						message: "No history found.",
						type: "danger",
						backgroundColor: "rgb(220,50,0)"
					});
				}
			}
		})
		.catch((error) => {
			console.log(error);
			setHistoryList();
			showMessage({
				message: "Network Error",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		});
	}

	function deleteAlert(id) {
		if(empty(id)) {
			setDeleteModal(false);
		} else {
			setDeleteModal(true);
		}
		setDeleteID(id);
	}

	function deleteHistory(id) {
		deleteAlert(null);
		fetch(config["api"] + "/output", {
			method: "DELETE",
			headers: {
				Accept: "application/json", "Content-Type": "application/json"
			},
			body: JSON.stringify({
				pin: config["pin"],
				id: id
			})
		})
		.then((json) => {
			return json.json();
		})
		.then(async (response) => {
			if("error" in response) {
				showMessage({
					message: response.error,
					type: "danger",
					backgroundColor: "rgb(220,50,0)"
				});
			} else {
				getHistory();
			}
		})
		.catch((error) => {
			console.log(error);
			showMessage({
				message: "Network Error",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		});
	}

	async function listFiles(files) {
		if(!empty(files)) {
			let paths = Object.keys(files);
			setFilesList(
				<View>
					{
						paths.map((file) => {
							return (
								<CardButton key={file} onPress={() => { toggleFile(file); }} backgroundColor={!empty(searchFiles) && Object.keys(searchFiles).includes(file) ? "rgb(0,150,250)" : "rgb(30,30,30)"}>
									<Text style={styles.textCard}>{file}</Text>
									<Text style={[styles.textCard, { marginTop:10, fontWeight:"bold" }]}>{files[file]}</Text>
								</CardButton>
							);
						})
					}
				</View>
			);
		}
	}

	async function toggleFile(file) {
		let current = searchFiles;

		if(current !== null) {
			let keys = Object.keys(current);

			if(keys.includes(file)) {
				delete current[file];
				if(Object.keys(current).length === 0) {
					setChanged("empty");
				} else {
					setChanged(new Date());
				}
			} else {
				let parts;
				if(file.includes("/")) {
					parts = file.split("/");
				} else {
					parts = file.split("\\");
				}
				let filename = parts[parts.length - 1];
				current = {...current, [file]:filename};
				setChanged(new Date());
			}
			setSearchFiles(current);
		}
	}

	function getFiles() {
		fetch(config["api"] + "/files?pin=" + config["pin"], {
			method: "GET",
			headers: {
				Accept: "application/json", "Content-Type": "application/json"
			}
		})
		.then((json) => {
			return json.json();
		})
		.then(async (response) => {
			if("error" in response && showPage === "files") {
				setAllFiles({});
				setSearchFiles({});
				setChanged("empty");
				showMessage({
					message: response.error,
					type: "danger",
					backgroundColor: "rgb(220,50,0)"
				});
			} else {
				if("files" in response) {
					let files = response["files"];
					listFiles(files);

					let selectedJSON = await AsyncStorage.getItem("selectedFiles");
					let selected = selectedJSON === null ? null : JSON.parse(selectedJSON);

					setAllFiles(files);
					setSearchFiles(selected);
					setChanged(new Date());
				}
			}
		})
		.catch((error) => {
			setAllFiles({});
			setSearchFiles({});
			setChanged("empty");
			console.log(error);
			showMessage({
				message: "Network Error",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		});
	}

	function getOutput(url) {
		setOutput();
		let update = setInterval(() => {
			if(showPage === "search") {
				fetch(url, {
					method: "GET",
					headers: {
						Accept: "text/plain", "Content-Type": "text/plain"
					}
				})
				.then((text) => {
					return text.text();
				})
				.then(async (response) => {
					if(typeof response === "object" && "error" in response) {
						showMessage({
							message: response.error,
							type: "danger",
							backgroundColor: "rgb(220,50,0)"
						});
					} else {
						let lines = response.split(/\r\n|\r|\n/);
						if(lines.length > 1000) {
							response = lines.slice(0, 1000);
							response.push("\n----- Output Truncated Due To Size -----");
							response = response.join("\n");
						}

						setOutput(response);
					
						if(response.includes("----- End Of Search") || response.includes("File not found.") || response.includes("----- Search Cancelled") || lines.length > 1000) {
							clearInterval(update);
							setCancel(null);
						}
					}
				})
				.catch((error) => {
					console.log(error);
					showMessage({
						message: "Network Error",
						type: "warning",
						backgroundColor: "rgb(240,135,35)"
					});
					clearInterval(update);
				});
			}
		}, 1000);
	}

	function saveSettings() {
		saveConfig().then((configuration) => {
			showMessage({
				message: "User configuration saved.",
				type: "success",
				backgroundColor: "rgb(50,200,75)"
			});
			setConfig(configuration);
		}).catch(() => {
			showMessage({
				message: "User configuration couldn't be saved.",
				type: "danger",
				backgroundColor: "rgb(220,50,0)"
			});
		});
	}

	async function saveConfig() {
		let configuration = { mac:settingsMAC, ip:settingsIP, port:settingsPort.toString(), pin:settingsPIN.toString(), api:null };
		return new Promise(async (resolve, reject) => {
			try {
				if(configuration["mac"].includes(":") && configuration["ip"].includes(".")) {
					await AsyncStorage.setItem("mac", configuration["mac"]).catch((error) => reject(error));
					await AsyncStorage.setItem("ip", configuration["ip"]).catch((error) => reject(error));
					await AsyncStorage.setItem("port", configuration["port"]).catch((error) => reject(error));
					await AsyncStorage.setItem("pin", configuration["pin"]).catch((error) => reject(error));
					configuration["api"] = "http://" + configuration["ip"] + ":" + configuration["port"];
					resolve(configuration);
				} else {
					reject();
				}
			} catch(e) {
				reject(e);
			}
		});
	}

	async function getConfig() {
		let configuration = { ip:null, port:null, pin:null, api:null };
		return new Promise(async (resolve, reject) => {
			configuration["mac"] = await AsyncStorage.getItem("mac").catch((error) => reject(error));
			configuration["ip"] = await AsyncStorage.getItem("ip").catch((error) => reject(error));
			configuration["port"] = await AsyncStorage.getItem("port").catch((error) => reject(error));
			configuration["pin"] = await AsyncStorage.getItem("pin").catch((error) => reject(error));
			configuration["api"] = "http://" + configuration["ip"] + ":" + configuration["port"];
			resolve(configuration);
		});
	}

	function checkConfig(configuration) {
		let valid = true;
		let needs = [];
		if(configuration === "initial") {
			return "initial";
		}
		if(empty(configuration["ip"])) {
			needs.push("IP");
		}
		if(empty(configuration["port"])) {
			needs.push("Port");
		}
		if(empty(configuration["pin"])) {
			needs.push("PIN");
		}
		if(empty(configuration["ip"]) || empty(configuration["port"]) || empty(configuration["pin"])) {
			valid = "Error. User configuration needs: ";
			valid += needs.join(", ") + ".";
		}
		return valid;
	}

	function awakenServer() {
		if(!empty(config["mac"]) && !empty(config["ip"])) {
			Wol.send(config["ip"], config["mac"], (resolve, message) => {
				if(resolve) {
					showMessage({
						message: "WOL packet sent.",
						type: "success",
						backgroundColor: "rgb(50,200,75)"
					});
				} else {
					showMessage({
						message: "Couldn't send the WOL packet.",
						type: "danger",
						backgroundColor: "rgb(220,50,0)"
					});
				}
			});
		} else {
			showMessage({
				message: "Both the MAC and IP address of the server are required.",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		}
	}

	function shutdownServer() {
		fetch(config["api"] + "/shutdown?pin=" + config["pin"], {
			method: "GET",
			headers: {
				Accept: "application/json", "Content-Type": "application/json"
			}
		})
		.then((json) => {
			return json.json();
		})
		.then(async (response) => {
			if(response.message === "Shutting down.") {
				showMessage({
					message: "Shutting down the server...",
					type: "success",
					backgroundColor: "rgb(50,200,75)"
				});
			} else {
				showMessage({
					message: "Couldn't shutdown the server.",
					type: "warning",
					backgroundColor: "rgb(240,135,35)"
				});
			}
		})
		.catch((error) => {
			console.log(error);
			showMessage({
				message: "Network Error",
				type: "warning",
				backgroundColor: "rgb(240,135,35)"
			});
		});
	}
}

function encrypt(publicKey, plaintext) {
	let crypt = new Crypt({ aesStandard:"AES-CTR", aesKeySize:256 });
	return crypt.encrypt(publicKey, plaintext);
}

function decrypt(privateKey, encrypted) {
	let crypt = new Crypt({ aesStandard:"AES-CTR", aesKeySize:256 });
	return crypt.decrypt(privateKey, encrypted);
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
	
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "rgb(20,20,20)",
		alignItems: "center",
		justifyContent: "flex-start",
	},
	viewApp: {
		flex: 1,
		width: "100%",
		height: "100%",
		backgroundColor: "rgb(20,20,20)",
		alignItems: "center",
		justifyContent: "flex-start",
	},
	viewLoading: {
		flex: 1,
		width: "100%",
		height: "100%",
		backgroundColor: "rgb(20,20,20)",
		alignItems: "center",
		justifyContent: "center",
	},
	textLoading: {
		fontSize: 32,
		fontFamily: "Arial",
		color: "rgb(255,255,255)",
		fontWeight: "bold",
	},
	topBar: {
		flex: 1,
		height: 70,
		maxHeight: 80,
		width: "100%",
		flexDirection: "row",
		marginTop: Constants.statusBarHeight,
	},
	topBarLeft: {
		flex: 1,
		position: "absolute",
		flexDirection: "row",
		left: 0,
		paddingLeft: 5,
		alignItems: "flex-start"
	},
	topBarRight: {
		flex: 1,
		position: "absolute",
		flexDirection: "row",
		right: 0,
		paddingRight: 5,
		alignItems: "flex-end"
	},
	textCard: {
		color: "rgb(255,255,255)",
		fontFamily: "Arial"
	},
	viewPage: {
		flex: 1,
		width: "100%",
		alignItems: "center",
		justifyContent: "flex-start",
	},
	viewScroll: {
		backgroundColor: "rgb(40,40,40)",
		width: "100%"
	},
	viewFileActions: {
		height: 80,
	},
	viewOutput: {
		backgroundColor: "rgb(40,40,40)",
		width: "100%"
	},
	textOutput: {
		color: "rgb(255,255,255)",
		padding: 20,
	},
	viewSearch: {
		height: 200,
	},
	inputSearch: {
		backgroundColor: "rgb(40,40,40)",
		color: "rgb(255,255,255)",
		paddingLeft: 10,
		paddingRight: 10,
		borderRadius: 10,
		marginTop: 20,
		height: 100,
		width: screenWidth - 40,
		textAlignVertical: "top"
	},
	inputSettings: {
		backgroundColor: "rgb(20,20,20)",
		color: "rgb(255,255,255)",
		paddingLeft: 10,
		paddingRight: 10,
		borderRadius: 10,
		marginTop: 20,
		height: 40,
		width: screenWidth - 140,
		textAlign: "left"
	},
	modalBackground: {
		position: "absolute",
		zIndex: 0, 
		backgroundColor: "rgba(0,0,0,0.8)", 
		width: "100%", 
		height: "100%"
	},
	modalForeground: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center"
	},
	modalText: {
		padding: 10,
		fontSize: 16,
		color: "rgb(255,255,255)",
		lineHeight: 25,
		fontWeight: "bold",
	},
	modalDelete: {
		padding: 10,
		zIndex: 1,
		height: 140,
		margin: 0,
		width: 220,
		borderRadius: 10,
		backgroundColor: "rgb(40,40,40)",
	},
	viewActions: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row"
	},
	buttonAction: {
		height: 40,
		paddingLeft: 12,
		paddingRight: 12,
		marginTop: 20,
		marginBottom: 20,
		marginRight: 10,
		marginLeft: 10,
		backgroundColor: "rgb(0,150,255)",
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 10
	},
	textAction: {
		color: "rgb(255,255,255)",
		marginTop: -2,
		fontSize: 18,
		fontWeight: "bold",
		fontFamily: "Arial"
	}
});