let playerManager;
let playerReady;
var tag = document.createElement('script');
var player;
const $moreVidsContainer = $('#more_videos_container');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

const PlayerManager = (function() {
	const LOCATION_CHANGE_SEC = 10;
	const VOLUME_CHANGE_PCENT = 5;

	const keyToAction = {
		f() { this.toggleFullScreen(); },
		k() { this.togglePlay(); },
		spacebar() { this.togglePlay(); },
		m() { this.toggleMute(); },
		left() { this.changeLocation(-LOCATION_CHANGE_SEC); },
		right() { this.changeLocation(LOCATION_CHANGE_SEC); },
		up() { this.changeVolume(VOLUME_CHANGE_PCENT); },
		down() { this.changeVolume(-VOLUME_CHANGE_PCENT); },
		enter() { return },
	}

	const requestFullscreen = (container) => {
		let func =  container.requestFullscreen
							  || container.webkitRequestFullScreen
							  || container.mozRequestFullScreen
							  || container.msRequestFullscreen;

		func.call(container);
	}

	const cancelFullscreen = () => {
		let func = document.webkitExitFullscreen
							 || document.mozCancelFullScreen
		 					 || document.msExitFullscreen
		 					 || document.exitFullscreen;

		func.call(document);
	}

	const isFullScreen = () => {
		return document.mozFullScreenElement
				   || document.msFullscreenElement
				   || document.webkitFullscreenElement;
	}

	const zeroToHundred = (n) => {
		if (n > 100) {
			n = 100;
		} else if (n < 0) {
			n = 0;
		}

		return n;
	}

	// const playerReadyEvent = () => {
	// 	player.playVideo();
	// }

  return {
		init(videoId) {
			player = new YT.Player('player', {
			  playerVars: {
			  	controls: '0',
			  },
			  events: {
			  	onReady: function() {
			  		playerReady = true;
			  	},
			  },
			});

			return this;
		},
		toggleFullScreen() {
			let playerContainer = $playerContainer.get(0);

			if (isFullScreen()) {
				cancelFullscreen();
				return;
			}

			requestFullscreen(playerContainer);
		},
		togglePlay() {
			let state = player.getPlayerState();

			if (state === 1) {
				player.pauseVideo();
			} else if (state === 2 || state === -1) {
				player.playVideo();
			}
		},
		changeVolume(change) {
			let newVolume = player.getVolume() + change;

			player.setVolume(zeroToHundred(newVolume));
		},
		toggleMute() {
			player.isMuted() ? player.unMute() : player.mute();
		},
		playVid(vidId) {
			player.loadVideoById(vidId);
		},
		stopVid() {
			player.stopVideo();
		},
		changeLocation(change) {
			let newTime = player.getCurrentTime() + change;

			player.seekTo(newTime);
		},
		keyHandler(key) {
			keyToAction[key].call(this);
		},
	}
})();

function onYouTubeIframeAPIReady() {
	playerManager = Object.create(PlayerManager).init();
}
