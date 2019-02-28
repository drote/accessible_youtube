'use strict';

const DEFAULT_SETTINGS = {
	gaze_aware: 'on',
	click_delay: 10,
	select_delay: 10,
	col_number: 4,
	row_number: 2,
	background_color: 'white',
}

// const NAVIGATION_KEYS = [ ENTER, LEFT_A, UP_A, RIGHT_A, DOWN_A ] = [ 13, 37, 38, 39, 40 ];
// const PLAY_KEYS = [ ESCAPE, SPACEBAR, F, K, M ] = [ 27, 32, 70, 75, 77, LEFT_A, UP_A, RIGHT_A, DOWN_A ];
const API_KEY = 'AIzaSyD0HiZ1FdFt3QK10ndUBUfddC6hyj19IW8';
const YOUTUBE_API_URL ='https://www.googleapis.com/youtube/v3/search';
const DEFAULT_QUERY_STRING = `part=snippet&key=${API_KEY}&maxResults=36`;
const LOCATION_CHANGE_SEC = 10;
const VOLUME_CHANGE_PCENT = 5;
const GA_ACTIVE_TEXT = 'מופעלת';
const GA_INACTIVE_TEXT = 'מופסקת';

const SETTINGS_URL = 'user_settings';
const arrowKeys = {
	'37': 'left',
	'38': 'up',
	'39': 'right',
	'40': 'down',
}

const navCharCodeToKey = {
	'13': 'enter',
	'33': 'pageUp',
	'34': 'pageDown',
	'36': 'home',
	...arrowKeys,
};

const playCharCodeToKey = {
	'27': 'escape',
	'32': 'spacebar',
	'70': 'f',
	'75': 'k',
	'77': 'm',
	...arrowKeys,
};

let page;

$(function() {
	const $body = $(document.body);
	const $contentDiv = $('#content');
	const $playerModal = $('#player_modal_layer');
	const $playerContainer = $('#player_container');
	const $seperator = $('#seperator');
	const $gaButtonIndicator = $('#ga_button');
	const $gaTextIndicator = $('#ga_text');
	const $querySpan = $('#query');
	const $logo = $('#logo');

	const GA_INDICATORS = [$gaButtonIndicator, $gaTextIndicator];
	const PLAYER_DIVS = [$playerContainer, $playerModal, $seperator];

	const Results = {
		init(vids, vidsPerChunk) {
			this.allResults = vids;
			this.assignChunks(vidsPerChunk);

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
		assignChunks(vidsPerChunk) {
			this.vidsPerChunk = vidsPerChunk;
			this.chunks = this.resultsToEuqalLengthChunks(this.allResults, vidsPerChunk);
			this.chunkNumber = this.chunks.length;
		}
	};

	const PlayerManager = (function() {
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
				} else if (state === 2) {
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

	const Page = (function() {
		Handlebars.registerHelper('shortenTitle', (title) => {
			if (title.length > 60) {
				let newTitle = title.substring(0, 57);

				return `${newTitle.replace(/ $/, '')}...`;
			}

			return title;
		});

		Handlebars.registerHelper('notHebrew', (title) => {
			let charCode = title.charCodeAt(0);

			return charCode < 1488 || charCode > 1514;
		});

		let playTimeout;
		let selectTimeout;
		let clickTimeout;

		const directionToChange = {
			left() { return 1; },
			right() { return -1; },
			up() { return -this.colNumber(); },
			down() { return this.colNumber(); },
			pageDown() { return this.vidsPerChunk(); },
			pageUp() { return -this.vidsPerChunk(); },
		}

		const makeQueryString = (query) => `${DEFAULT_QUERY_STRING}&q=${query}`;
		const empty = ($elm) => $elm.length === 0;
		const activeAnimation = ($elm) => $elm.find('.progress_circle').length !== 0;
		const getFigureHieght = (rowNum) => `${90 / rowNum}%`;
		const getFigureWidth = (colNum) => `${90 / colNum}%`;
		const getBackgroundColor = (color) => color;
		const getAnimationLength = (delayTime) => `${delayTime / 1000}s`;
		const getFontSize = (rowNum) => {
			return {
				'5': '0.6rem',
				'4': '0.8rem',
				'3': '0.8rem',
				'2': '1.2rem',
				'1': '1.4rem',
			}[rowNum];
		}

		const settingsJsonToObj = (json) => {
			let settings = JSON.parse(json);

			Object.keys(settings).forEach((key) => {
				let val = settings[key];

				if ($.isNumeric(settings[key])) {
					val = parseInt(settings[key], 10);
				}

				settings[key] = val;
			});

			return settings;
		}

		const togglePlayerDivs = () => {
			PLAYER_DIVS.forEach(($div) => $div.toggle());
		}

		const toggleGaIndicators = (state) => {
			GA_INDICATORS.forEach(($ind) => $ind.toggle(state));
		}

		const navModeKeyEvent = function(key) {
			key = navCharCodeToKey[key];

			if (!key) return;

			this.respondToNavKey(key);
		}

		const playModeKeyEvent = function(key) {
			key = playCharCodeToKey[key];

			if (!key) return;

			this.respondToPlayKey(key);
		}

		const keydownHandler = function(e) {
			let key = String(e.which);

			if (this.playMode()) {
				playModeKeyEvent.call(this, key);
				return;
			}

			navModeKeyEvent.call(this, key);
		}

		const vidMouseIn = function(e) {
			if (this.gaInactive()) return;

			let $wrapper = $(e.target);

			if ($wrapper.is('.selected')) {
				this.gazePlay($wrapper);
				return;
			}

			this.gazeSelect($wrapper);
		}

		const vidMouseOut = function() {
			if (this.gaInactive()) return;

			this.cancelGazeSelect();
			this.cancelGazePlay();
		}

		const vidClick = function(e) {
			let $wrapper = $(e.currentTarget);

			this.startVideo($wrapper);
		}

		const gaButtonMouseIn = function() {
			this.gazeGeneric($gaButtonIndicator);
		}

		const gaButtonMouseOut = function() {
			this.cancelGazeGeneric($gaButtonIndicator);
		}

		const gaButtonClick = function() {
			this.toggleGABreak(this.onBreak());
		}

		return {
			results: null,
			playerManager: null,
			userSettings: null,
			thumbTemplate: null,
			pageNavTemplate: null,
			gaBreak: false,

			init() {
				this.getTemplates();
				this.bindEvents();
				this.getQuery();
				this.initSettings()
						.then(() => this.initResults())
						.then(() => this.initDisplay());

				return this;
			},
			getTemplates() {
				Handlebars.registerPartial('vid_thumb_partial', $('#vid_thumb_partial').html());
				this.thumbTemplate = Handlebars.compile($('#thumbnails_template').html());

				$('[type="text/handlebars=x"]').remove();
			},
			bindEvents() {
				$body.on('keydown', keydownHandler.bind(this));
				$contentDiv.on('mouseenter', '.wrapper', vidMouseIn.bind(this));
				$contentDiv.on('mouseleave', '.wrapper', vidMouseOut.bind(this));
				$contentDiv.on('click', '.wrapper', vidClick.bind(this));
				$gaButtonIndicator.on('mouseenter', gaButtonMouseIn.bind(this));
				$gaButtonIndicator.on('mouseleave', gaButtonMouseOut.bind(this));
				$gaButtonIndicator.on('click', gaButtonClick.bind(this));
			},
			getQuery() {
				const urlParams = new URLSearchParams(window.location.search);
				const searchQuery = urlParams.get('q');

				this.query = searchQuery;
			},
			initSettings() {
				const that = this;

				return this.getUserSettings().then(function(response) {
					if (response) {
						that.userSettings = settingsJsonToObj(response);
					} else {
						that.userSettings = DEFAULT_SETTINGS;
					}
				});
			},
			initResults() {
				let that = this;

				return this.getResults().done(function(data) {
					let vidsPerChunk = that.vidsPerChunk();
					let vids = data.items;

					that.results = Object.create(Results).init(vids, vidsPerChunk);
				})

				.fail(function() {
					let vidsPerChunk = that.vidsPerChunk();
					let vids = tmpData.items;

					that.results = Object.create(Results).init(vids, vidsPerChunk);
				});
			},
			initDisplay() {
				feather.replace();

				this.chunkN = 0;
				this.setCSSProperties();
				this.initHeader();
				this.showChunk(0);
				this.selectWrapper(0);
			},
			getResults() {
				const queryString = makeQueryString(this.query);

				return this.ajaxCall(YOUTUBE_API_URL, queryString);
			},
			getUserSettings() {
				return this.ajaxCall(SETTINGS_URL);
			},
			refreshView() {
				this.initSettings()
						.then(() => this.modifyResultsObj.call(this) )
						.then(() => this.initDisplay());
			},
			modifyResultsObj() {
				this.results.assignChunks(this.vidsPerChunk());
			},
			setCSSProperties() {
				$body.css({
					overflow: 'hidden',
					'--figureWidth': getFigureWidth(this.colNumber()),
					'--figureHeight': getFigureHieght(this.rowNumber()),
					'--figFontSize': getFontSize(this.rowNumber()),
					'--animationLength': getAnimationLength(this.gaClickTime()),
					'--BGColor': getBackgroundColor(this.backgroundColor()),
				});
			},
			initHeader() {
				let gaOn = !this.gaDisabled();

				$querySpan.text(this.query);
				toggleGaIndicators(gaOn);
			},
			showChunk(n) {
				let vids = this.results.getChunk(n);
				let html = this.thumbTemplate({ vids }).replace('-->', '');

				$contentDiv.children().remove();
				$contentDiv.append(html);

				this.chunkN = n;
			},
			selectWrapper(idx) {
				$('.selected').removeClass('selected');
				this.wrappers(idx).addClass('selected');
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
				let change = directionToChange[direction].call(this);
				let nextIdx = idx + change;
				let maxAllowedIdx = this.results.vidsPerChunk - 1;

				if (nextIdx > maxAllowedIdx) {
					nextIdx = this.nextOutOfBoundsIdx(idx, direction);
					this.showNextChunk();
				} if (nextIdx < 0) {
					nextIdx = this.nextOutOfBoundsIdx(idx, direction);
					this.showPrevChunk();
				}

				this.selectWrapper(nextIdx);
			},
			idxAcrossPage(idx, direction) {
				let compensation = ((this.rowNumber() - 1) * this.colNumber());

				if (direction === 'down') {
					compensation = -compensation;
				}

				return idx + compensation;
			},
			nextOutOfBoundsIdx(idx, direction) {
				switch (direction) {
					case 'up':
					case 'down':
						idx = this.idxAcrossPage(idx, direction);
						break;
					case 'left':
						idx = 0;
						break;
					case 'right':
						idx = -1;
				}

				return idx;
			},
			gaDisabled() {
				return !this.userSettings['gaze_aware'];
			},
			onBreak() {
				return this.gaBreak;
			},
			gaInactive() {
				return this.gaDisabled() || this.onBreak();
			},
			startVideo($wrapper) {
				let vidId = $wrapper.find('figure').data('vid_id');

				togglePlayerDivs();

				if (this.firstVideo()) {
					this.makeNewPlayer(vidId);
					return;
				}

				this.playerManager.playVid(vidId);
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
				return $playerContainer.is(':visible');
			},
			wrappers(n) {
				let $wrappers = $('.wrapper');

				return n === undefined ? $wrappers : $wrappers.eq(n);
			},
			countdownAnimate($elm) {
				if (activeAnimation($elm)) return;

				// this.setCSSCircleWidth($elm);
				this.createProgCricleOn($elm);
			},
			setCSSCircleWidth($elm) {
				let elmHeight = $elm.css('height');
				let circleWidth = parseInt(elmHeight, 10) / 2;
				document.body.style.setProperty('--circleRadius', `${circleWidth}px`);
			},
			createProgCricleOn($elm) {
				let $circle = $('<div>').addClass('progress_circle');
				$elm.append($circle);
				$circle.addClass('countdown_fill');
			},
			playVidWithDelay($wrapper) {
				let playDelay = this.gaClickTime();
				playTimeout = setTimeout(() => { this.startVideo($wrapper) }, playDelay);
			},
			clickWithDelay($elm) {
				let clickDelay = this.gaClickTime();
				clickTimeout = setTimeout(() => { $elm.trigger('click') }, clickDelay );
			},
			gazePlay($wrapper) {
				this.countdownAnimate($wrapper);
				this.playVidWithDelay($wrapper);
			},
			cancelGazePlay() {
				this.removePlayInterval();
				this.removeProgressCircle();
			},
			gazeSelect($wrapper) {
				let selectDelay = this.gaSelectTime();
				let wrapperIdx = $wrapper.index();

				selectTimeout = setTimeout(() => {
					this.selectWrapper(wrapperIdx);
					this.gazePlay($wrapper);
				}, selectDelay);
			},
			cancelGazeSelect() {
				clearInterval(selectTimeout);
			},
			gazeGeneric($elm) {
				this.countdownAnimate($elm);
				this.clickWithDelay($elm);
			},
			cancelGazeGeneric($elm) {
				this.removeProgressCircle();
				clearInterval(clickTimeout);
			},
			removeProgressCircle() {
				$('.progress_circle').stop(true, false).remove();
			},
			removePlayInterval() {
				clearInterval(playTimeout);
			},
			respondToNavKey(key) {
				let $selected = $('.selected');
				let selectedIdx = $selected.index();

				switch (key) {
					case 'enter':
						this.startVideo($selected);
						break;
					case 'home':
						$logo.trigger('click');
						break;
					default:
						this.navigateFrom(selectedIdx, key);
				}
			},
			respondToPlayKey(key) {
				if (key === 'escape') {
					this.closePlayer();
					return;
				}

				this.playerManager.keyHandler(key);
			},
			toggleGABreak(onBreak) {
				let newText = onBreak ? GA_ACTIVE_TEXT : GA_INACTIVE_TEXT;

				$gaButtonIndicator.toggleClass('active', onBreak);
				$gaTextIndicator.find('span').text(newText);
				this.gaBreak = !onBreak;
			},
			ajaxCall(url, data) {
				return $.ajax({ url, data }).then((data) => data);
			},
			vidsPerChunk() {
				return this.colNumber() * this.rowNumber();
			},
			colNumber() {
				return this.userSettings['col_number'];
			},
			rowNumber() {
				return this.userSettings['row_number'];
			},
			gaClickTime() {
				return this.userSettings['click_delay'] * 100;
			},
			gaSelectTime() {
				return this.userSettings['select_delay'] * 100;
			},
			backgroundColor() {
				return this.userSettings['background_color'];
			},
		};
	})();

	Object.create(Page).init();
});