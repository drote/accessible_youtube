'use strict';

const DEFAULT_SETTINGS = {
	gaze_aware: 'on',
	click_delay: 10,
	select_delay: 10,
	col_number: 4,
	row_number: 2,
	background_color: 'white',
	select_color: '#b22222',
}

const API_KEY = 'AIzaSyD0HiZ1FdFt3QK10ndUBUfddC6hyj19IW8';
const YOUTUBE_API_URL ='https://www.googleapis.com/youtube/v3/search';

let REQUEST_PARAMS = {
	key: API_KEY,
	part: 'snippet',
	maxResults: '50',
	fields: 'items(id(videoId),snippet(title,thumbnails(high)))',
	type: 'video',
};

const makeQueryString = (query) => {
	let params = [];
	REQUEST_PARAMS['q'] = query;

	Object.keys(REQUEST_PARAMS).forEach((prm) => {
		params.push(`${prm}=${REQUEST_PARAMS[prm]}`);
	});

	return encodeURI(`${params.join('&')}`);
}

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
	'32': 'spacebar',
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
	// const $gaButtonIndicator = $('#ga_button');
	// const $gaTextIndicator = $('#ga_text');
	const $querySpan = $('#query');
	const $logo = $('#logo');

	// const GA_INDICATORS = [$gaButtonIndicator, $gaTextIndicator];
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
		resultsToChunks(vids, chunkLength) {
			let chunks = [];

			for (let i = 0; i < vids.length; i += chunkLength) {
				let startIdx = i;
				let endIdx = i + chunkLength;
				let chunk = vids.slice(startIdx, endIdx);

				chunks.push(chunk);
			}

			return chunks;
		},
		assignChunks(vidsPerChunk) {
			this.vidsPerChunk = vidsPerChunk;
			this.chunks = this.resultsToChunks(this.allResults, vidsPerChunk);
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
			if (title.length > 80) {
				let newTitle = title.substring(0, 77);

				return `${newTitle.replace(/ $/, '')}...`;
			}

			return title;
		});

		Handlebars.registerHelper('isHebrew', (title) => {
			let charCode = title.charCodeAt(0);

			return charCode > 1488 && charCode < 1514;
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
				'2': '1rem',
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

		// const toggleGaIndicators = (state) => {
		// 	GA_INDICATORS.forEach(($ind) => $ind.toggle(state));
		// }

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
			if (this.gaDisabled()) return;

			let $wrapper = $(e.target);

			if ($wrapper.is('.selected')) {
				this.gazePlay($wrapper);
				return;
			}

			this.gazeSelect($wrapper);
		}

		const vidMouseOut = function() {
			if (this.gaDisabled()) return;

			this.cancelGazeSelect();
			this.cancelGazePlay();
		}

		const vidClick = function(e) {
			let $wrapper = $(e.currentTarget);

			this.startVideo($wrapper);
		}

		// const gaButtonMouseIn = function() {
		// 	this.gazeGeneric($gaButtonIndicator);
		// }

		// const gaButtonMouseOut = function() {
		// 	this.cancelGazeGeneric($gaButtonIndicator);
		// }

		// const gaButtonClick = function() {
		// 	this.toggleGABreak(this.onBreak());
		// }

		return {
			results: null,
			playerManager: null,
			userSettings: null,
			thumbTemplate: null,
			pageNavTemplate: null,
			// onGaBreak: false,

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
				// $gaButtonIndicator.on('mouseenter', gaButtonMouseIn.bind(this));
				// $gaButtonIndicator.on('mouseleave', gaButtonMouseOut.bind(this));
				// $gaButtonIndicator.on('click', gaButtonClick.bind(this));
			},
			getQuery() {
				const urlParams = new URLSearchParams(window.location.search);
				const searchQuery = urlParams.get('q');

				this.query = searchQuery;
			},
			initSettings() {
				const that = this;

				return this.getUserSettings()
									 .then(function(response) {
											that.userSettings = settingsJsonToObj(response);
										});
			},
			initResults() {
				let that = this;

				return this.getResults().done(function(data) {
					let vidsPerChunk = that.vidsPerChunk();
					let vids = data.items;

					that.results = Object.create(Results).init(vids, vidsPerChunk);
				});

				// .fail(function() {
				// 	let vidsPerChunk = that.vidsPerChunk();
				// 	let vids = tmpData.items;

				// 	that.results = Object.create(Results).init(vids, vidsPerChunk);
				// });
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
				document.body.style.setProperty('--figuresPerRow', this.colNumber());
				document.body.style.setProperty('--figuresPerCol', this.rowNumber());
				$body.css({
					overflow: 'hidden',
					'--figureWidth': getFigureWidth(this.colNumber()),
					'--figureHeight': getFigureHieght(this.rowNumber()),
					'--figFontSize': getFontSize(this.rowNumber()),
					'--animationLength': getAnimationLength(this.gaClickTime()),
					'--BGColor': this.backgroundColor(),
					'--selectColor': this.chooserColor(),
					'--circleColor': `${this.chooserColor()}bf`,
				});
			},
			initHeader() {
				// let gaOn = !this.gaDisabled();

				$querySpan.text(this.query);
				// toggleGaIndicators(gaOn);
			},
			showChunk(n) {
				let vids = this.results.getChunk(n);
				let html = this.thumbTemplate({ vids }).replace('-->', '');

				$contentDiv.empty();
				$contentDiv.append(html);

				let rightMarginPcent = this.colNumber() === 1 ? '5%' : '2.5%';
				$(`.wrapper:nth-of-type(${this.colNumber()}n)`).css('margin-left', '0');
				$(`.wrapper:nth-of-type(${this.colNumber()}n + 1)`).css('margin-right', rightMarginPcent);

				this.chunkN = n;
			},
			selectWrapper(idx) {
				$('.selected').removeClass('selected');
				let $wrapper = this.wrappers(idx);

				if (empty($wrapper)) {
					$wrapper = this.wrappers(0);
				}

				$wrapper.addClass('selected');
			},
			showNextChunk() {
				let nextChunk = (this.chunkN + 1);

				this.showChunk(nextChunk);
			},
			showPrevChunk() {
				let prevChunk = this.chunkN - 1;

				this.showChunk(prevChunk);
			},
			lastChunk(chunk) {
				return chunk === this.results.chunkNumber - 1;
			},
			firstChunk(chunk) {
				return chunk === 0;
			},
			navigateFrom(idx, direction) {
				let change = directionToChange[direction].call(this);
				let nextIdx = idx + change;
				let maxAllowedIdx = this.results.vidsPerChunk - 1;

				if (nextIdx > maxAllowedIdx) {
					if (this.lastChunk(this.chunkN)) return;

					nextIdx = this.nextOutOfBoundsIdx(idx, direction);
					this.showNextChunk();
				} if (nextIdx < 0) {
					if (this.firstChunk(this.chunkN)) return;

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
				return this.userSettings['gaze_aware'] === 'off';
			},
			// onBreak() {
			// 	return this.onGaBreak;
			// },
			// gaInactive() {
			// 	return this.gaDisabled();
			// },
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

				this.setCSSCircleWidth($elm);
				this.createProgCricleOn($elm);
			},
			setCSSCircleWidth($elm) {
				let elmHeight = $elm.css('height');
				let circleWidth = parseInt(elmHeight, 10) / 2.5;

				circleWidth = circleWidth < 40 ? 40 : circleWidth;

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
					case 'spacebar':
						$gaButtonIndicator.trigger('click');
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
			// toggleGABreak(onBreak) {
			// 	let newText = onBreak ? GA_ACTIVE_TEXT : GA_INACTIVE_TEXT;

			// 	$gaButtonIndicator.toggleClass('active', onBreak);
			// 	$gaTextIndicator.find('span').text(newText);
			// 	this.onGaBreak = !onBreak;
			// },
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
			chooserColor() {
				return this.userSettings['select_color'];
			}
		};
	})();

	Object.create(Page).init();
});