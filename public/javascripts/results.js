'strict-mode';

const FIGURE_WIDTHS = {
	'4': '23%',
	'2': '45%',
};

const FIGURE_HEIGHTS = {
	'4': '22%',
	'3': '30%',
	'2': '40%',
	'1': '90%',
};

const FIGURE_FONT_SIZE = {
	'4': '0.7rem',
	'3': '0.9rem',
	'2': '1.4rem',
	'1': '2rem',
}

const DEFAULT_SETTINGS = {
	time_to_play: 100,
	col_number: 4,
	row_number: 2,
}

const NAVIGATION_KEYS = [ ENTER, LEFT_A, UP_A, RIGHT_A, DOWN_A ] = [ 13, 37, 38, 39, 40 ];
const PLAY_KEYS = [ ESCAPE, SPACEBAR, F, K, M ] = [ 27, 32, 70, 75, 77, LEFT_A, UP_A, RIGHT_A, DOWN_A ];
const API_KEY = 'AIzaSyD0HiZ1FdFt3QK10ndUBUfddC6hyj19IW8';
const YOUTUBE_API_URL ='https://www.googleapis.com/youtube/v3/search';
const DEFAULT_QUERY_STRING = `part=snippet&key=${API_KEY}&maxResults=36`;
let page;

$(function() {
	const $body = $(document.body);
	const $contentDiv = $('#content');
	const $playerModal = $('#player_modal_layer');
	const $playerContainer = $('#player_container');
	const $seperator = $('#seperator');
	const PLAYER_DIVS = [$playerContainer, $playerModal, $seperator];
	const $settingsA = $('header a');

	const Results = {
		init(vids, vidsPerChunk) {
			this.vidsPerChunk = vidsPerChunk;
			this.allResults = vids;
			this.chunks = this.resultsToEuqalLengthChunks(this.allResults, this.vidsPerChunk);
			this.chunkNumber = this.chunks.length;

			return this;
		},
		getChunk(n) {
			return this.chunks[n];
		},
		resultsToEuqalLengthChunks(vids, chunkLength) {
			let chunks = [];

			for (let i = 0; i < vids.length; i += chunkLength) {
				let startIdx = i;
				let endIdx = i + chunkLength;
				let chunk = vids.slice(startIdx, endIdx);

				if (chunk.length === chunkLength) {
					chunks.push(chunk);
				}
			}

			return chunks;
		},
		modifyResults(vidsPerChunk) {
			this.vidsPerChunk = vidsPerChunk;
			this.chunks = this.resultsToEuqalLengthChunks(this.allResults, this.vidsPerChunk);
			this.chunkNumber = this.chunks.length;
		}
	};

	const PlayerManager = (function() {
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
				return 100;
			} else if (n < 0) {
				return 0;
			}

			return n;
		}

		const playerReadyEvent = () => {
			player.playVideo();
		}

	  return {
			init(videoId) {
				player = new YT.Player('player', {
			  videoId,
			  events: {
			  	'onReady': playerReadyEvent,
			  },
			});

				return this;
			},
			toggleFullScreen() {
				if (!isFullScreen()) {
					requestFullscreen($playerContainer.get(0));
				} else {
					cancelFullscreen();
				}
			},
			togglePlay() {
				let state = player.getPlayerState();

				switch (state) {
					case 1:
						player.pauseVideo();
						break;
					case 2:
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
				player.seekTo(player.getCurrentTime() + change);
			},
		}
	})();

	const Page = (function() {
		let playTimeout;
		let selectTimeout;

		const endsWithSpace = (title) => title.substring(title.length -1) === ' ';
		const tooLong = (title) => title.length > 49;

		Handlebars.registerHelper('shortenTitle', (title) => {
		if (tooLong(title)) {
			let newTitle = title.substring(0, 46);

			if (endsWithSpace(newTitle)) {
				newTitle = newTitle.substring(0, newTitle.length - 1);
			}

			return newTitle + '...';
		}

		return title;
		});

		Handlebars.registerHelper('notHebrew', (title) => {
			let charCode = title.substring(0).charCodeAt(0);

			return charCode < 1488 || charCode > 1514;
		});

		const makeQueryString = (query) => `${DEFAULT_QUERY_STRING}&q=${query}`;
		const empty = ($elm) => $elm.length === 0;

		const navModeKeyEvent = function(key) {
			if (!NAVIGATION_KEYS.includes(key)) {
				return;
			}

			let $currentSelected = $('.selected');
			let currentIdx = $currentSelected.index();

			switch (key) {
				case ENTER:
					this.startVideo($currentSelected);
					break;
				case LEFT_A:
					this.navigateFrom(currentIdx, 'left');
					break;
				case UP_A:
					this.navigateFrom(currentIdx, 'up');
					break;
				case RIGHT_A:
					this.navigateFrom(currentIdx, 'right');
					break;
				case DOWN_A:
					this.navigateFrom(currentIdx, 'down');;
			}
		}

		const playModeKeyEvent = function(key) {
			if (!PLAY_KEYS.includes(key)) {
				return;
			}

			let player = this.playerManager;

			switch (key) {
				case F:
					player.toggleFullScreen();
					break;
				case SPACEBAR:
				case K:
				 player.togglePlay();
				 break;
				case M:
				 player.toggleMute();
				 break;
				case LEFT_A:
					player.changeLocation(-10);
					break;
				case UP_A:
					player.changeVolume(5);
					break;
				case RIGHT_A:
					player.changeLocation(10);
					break;
				case DOWN_A:
					player.changeVolume(-5);
					break;
				case ESCAPE:
					this.closePlayer();
			}
		}

		const keydownHandler = function(e) {
			let key = e.which;

			if (!this.playMode()) {
				navModeKeyEvent.call(this, key);
			} else {
				playModeKeyEvent.call(this, key);
			}
		}

		const mouseInHandler = function(e) {
			if (this.eyegazeDisabled() || this.eyegazeBreak()) {
				return;
			}

			let $fig = $(e.target);

			if ($fig.is('.selected')) {
				let delay = this.userSettings['time_to_play'] * 10;

				this.countdownAnimate($fig, delay);
				playTimeout = setTimeout(() => {
					this.startVideo($fig)
				}, delay);
			} else {
				selectTimeout = setTimeout(() => {
					this.selectFigure($fig.index());
					mouseInHandler.call(this, e);
				}, 1000);
			}
		}

		const mouseoutHandler = function() {
			if (this.eyegazeDisabled() || this.eyegazeBreak()) {
				return;
			}

			this.cancelCountdown();
			clearInterval(selectTimeout);
			clearInterval(playTimeout);
		}

		const openSettings = function(e) {
			e.preventDefault();

			if ($('#settings').not(':visible')) {
				$('#settings_modal_layer').show();
				let $div = $('#settings');
				$div.load('/settings', function() {
					$body.append($div);
					$div.css('width', '0').show();
					$div.animate({width: '25%'}, 700);
				});
			}
		}

		const togglePlayerDivs = () => {
			PLAYER_DIVS.forEach(($div) => $div.toggle());
		}

		const eyeGazeToggle = function(e) {
			if ($('#box.ga_ind').is('.active')) {
				$('#box.ga_ind').removeClass('active');
				$('#text.ga_ind').find('span').text('מופסק');
				this.userSettings.gaBreak = true;
			} else {
				$('#box.ga_ind').addClass('active');
				$('#text.ga_ind').find('span').text('מופעל');
				this.userSettings.gaBreak = false;
			}
		}

		return {
			results: null,
			playerManager: null,
			userSettings: null,

			init() {
				this.chunkN = 0;
				this.getTemplates();
				this.initializeSearch();
				this.bindEvents();

				return this;
			},
			getTemplates() {
				Handlebars.registerPartial('vid_thumb_partial', $('#vid_thumb_partial').html());

				this.thumbTemplate = Handlebars.compile($('#thumbnails_template').html());
				this.pageNavTemplate = Handlebars.compile($('#page_nav_template').html());
			},
			bindEvents() {
				$body.on('keydown', keydownHandler.bind(this));

				$contentDiv.on('mouseenter', '.figure', mouseInHandler.bind(this));
				$contentDiv.on('mouseleave', '.figure', mouseoutHandler.bind(this));
				$settingsA.on('click', openSettings.bind(this));
				$('#box.ga_ind').on('click', eyeGazeToggle.bind(this));
			},
			initializeSearch() {
				const urlParams = new URLSearchParams(window.location.search);
				const searchQuery = urlParams.get('q');
				let searchCallback = this.searchAndHandleResults.bind(this, encodeURI(searchQuery));

				this.query = searchQuery;
				this.getUserSettings(searchCallback)
			},
			getUserSettings(...callbacks) {
				let doneCallbacks = [this.assignUserSettings.bind(this), ...callbacks];

				$.ajax({
					url: 'user_settings'
				}).done(doneCallbacks);
			},
			assignUserSettings(response) {
				let settings = DEFAULT_SETTINGS;

				if (response) {
					settings = JSON.parse(response);

					Object.keys(settings).forEach((key) => {
						let val = settings[key];

						if ($.isNumeric(settings[key])) {
							val = parseInt(settings[key], 10);
						}

						settings[key] = val;
					});
				}

				this.userSettings = settings;
			},
			searchAndHandleResults(query) {
				let boundAssignResults = this.assignResults.bind(this);
				let callbacks = [boundAssignResults, this.initialDisplay.bind(this)];

				this.getResults(query, callbacks);
			},
			getResults(query, doneCallbacks) {
				const queryString = makeQueryString(query);

				$.ajax({
					url: YOUTUBE_API_URL,
					data: queryString,
				}).done(doneCallbacks);
			},
			assignResults(response) {
				let vidsPerChunk = this.userSettings['col_number'] * this.userSettings['row_number'];
				let vids = response.items;

				this.results = Object.create(Results).init(vids, vidsPerChunk);
			},
			initialDisplay() {
				this.setCSSProperties();
				this.fillHeader();
				this.showChunk(0);
				this.selectFigure(0);
			},
			refreshDisplay() {
				this.chunkN = 0;
				this.setCSSProperties();
				this.fillHeader();
				this.showChunk(0);
				this.selectFigure(0);
			},
			refreshView() {
				this.getUserSettings(this.modifyResultsObj.bind(this), this.refreshDisplay.bind(this));
			},
			modifyResultsObj() {
				let vidsPerChunk = this.userSettings['col_number'] * this.userSettings['row_number'];
				this.results.modifyResults(vidsPerChunk);
			},
			setCSSProperties() {
				let settings = this.userSettings;
				let vids = settings['col_number'] * settings['row_number'];
				let figWidth = FIGURE_WIDTHS[settings['col_number']];
				let figHeight = FIGURE_HEIGHTS[settings['row_number']];
				let figFont = FIGURE_FONT_SIZE[settings['row_number']];

				document.body.style.setProperty('--figureWidth', figWidth);
				document.body.style.setProperty('--figureHeight', figHeight);
				document.body.style.setProperty('--figureFont', figFont || '0.8rem');
				$contentDiv.css('backgroundColor', settings['background_color']);
			},
			fillHeader() {
				$('#query').text(this.query);
				$('.ga_ind').toggle(!this.eyegazeDisabled());
			},
			showChunk(n) {
				let vids = this.results.getChunk(n);
				let html = this.thumbTemplate({ vids }).replace('-->', '');

				$contentDiv.children().remove();
				$contentDiv.append(html);

				this.chunkN = n;
			},
			selectFigure(idx) {
				$('.selected').removeClass('selected');
				$('.highlight').removeClass('highlight');
				this.figures(idx).addClass('selected');
				this.figures(idx).find('figure').addClass('highlight');
			},
			showNextChunk() {
				let nextChunk = (this.chunkN + 1) % this.results.chunkNumber;

				this.showChunk(nextChunk);
			},
			showPrevChunk() {
				let prevChunk = this.chunkN - 1;

				if (prevChunk < 0) {
					prevChunk = this.results.chunkNumber - 1;
				}

				this.showChunk(prevChunk);
			},
			navigateFrom(idx, direction) {
				let change = this.getIdxChange(direction);
				let nextIdx = idx + change;
				let maxAllowedIdx = this.results.vidsPerChunk - 1;

				if (nextIdx > maxAllowedIdx) {
					this.showNextChunk();
					nextIdx = direction === 'down' ? this.idxAcross(idx, direction) : 0;
				} else if (nextIdx < 0) {
					this.showPrevChunk();
					nextIdx = direction === 'up' ? this.idxAcross(idx, direction) : -1;
				}

				this.selectFigure(nextIdx);
			},
			idxAcross(idx, direction) {
				let rowLength = this.userSettings['col_number'];
				let rowNum = this.userSettings['row_number'];
				let compensation = ((rowNum - 1) * rowLength);

				if (direction === 'down') {
					compensation = -compensation;
				}

				return idx + compensation;
			},
			getIdxChange(direction) {
				let rowLength = this.userSettings['col_number'];

				switch (direction) {
					case 'left':
						return 1;
					case 'right':
						return -1;
					case 'up':
						return -rowLength;
					case 'down':
						return rowLength;
				}
			},
			eyegazeDisabled() {
				return !this.userSettings['gaze_aware'];
			},
			eyegazeBreak() {
				return this.userSettings['gaBreak'];
			},
			lastChunk(chunk) {
				return this.results.getChunk(chunk + 1) === undefined;
			},
			startVideo($vid) {
				let vidId = $vid.find('figure').data('vid_id');
				togglePlayerDivs();

				if (this.firstVideo()) {
					this.makeNewPlayer(vidId);
				} else {
					this.playerManager.playVid(vidId);
				}
			},
			firstVideo() {
				return this.playerManager === null;
			},
			makeNewPlayer(vidId) {
				this.playerManager = Object.create(PlayerManager).init(vidId);
			},
			closePlayer() {
				this.playerManager.stopVid();
				togglePlayerDivs();
			},
			playMode() {
				return $playerModal.is(':visible');
			},
			figures(n) {
				let $figures = $('.figure');

				if (n === undefined) {
					return $figures;
				}

				return $figures.eq(n);
			},
			countdownAnimate($fig, animLength) {
				if ($fig.find('.countdown_bar').length === 0) {
					let $bar = $('<div>');
					$bar.addClass('countdown_bar');
					$fig.append($bar);
					$bar.show().animate({height: '100%'}, animLength, function() {
						$bar.remove();
					});
				}
			},
			cancelCountdown($fig) {
				$('.countdown_bar').stop(true, false).hide().remove();
			},
		};
	})();

	page = Object.create(Page).init();
});