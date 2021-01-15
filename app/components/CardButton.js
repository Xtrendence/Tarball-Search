import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get("window").width;

export default class CardButton extends React.PureComponent {
	constructor(props) {
		super(props);
	}

	render() {
		return (
			<TouchableOpacity style={[styles.card, { backgroundColor:this.props.backgroundColor }]} onPress={this.props.onPress} onLongPress={this.props.onLongPress}>
				{this.props.children}
			</TouchableOpacity>
		);
	}
}

const styles = StyleSheet.create({
	card: {
		marginTop: 20,
		width: screenWidth - 40,
		padding: 10,
		borderRadius: 10,
		backgroundColor: "rgb(30,30,30)",
	},
});