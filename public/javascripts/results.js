'strict-mode';

const FIGURE_WIDTHS = {
	'4': '21%',
	'2': '45%',
};

const FIGURE_HEIGHTS = {
	'4': '22%',
	'3': '26%',
	'2': '40%',
	'1': '90%',
};

const FIGURE_FONT_SIZE = {
	'4': '0.7rem',
	'3': '0.9rem',
	'2': '1.4rem',
	'1': '2rem',
}

const FIGURE_PADDING = {
	'4': '2%',
	'3': '5%',
	'2': '7%',
	'1': '9%',
}

const DEFAULT_SETTINGS = {
	time_to_play: 1,
	col_number: 4,
	row_number: 2,
}

const NAVIGATION_KEYS = [ ENTER, LEFT_A, UP_A, RIGHT_A, DOWN_A ] = [ 13, 37, 38, 39, 40 ];
const PLAY_KEYS = [ ESCAPE, SPACEBAR, F, K, M ] = [ 27, 32, 70, 75, 77, LEFT_A, UP_A, RIGHT_A, DOWN_A ];
const API_KEY = 'AIzaSyD0HiZ1FdFt3QK10ndUBUfddC6hyj19IW8';
const YOUTUBE_API_URL ='https://www.googleapis.com/youtube/v3/search';
const DEFAULT_QUERY_STRING = `part=snippet&key=${API_KEY}&maxResults=50`;

$(function() {
	const $body = $(document.body);
	const $contentDiv = $('#content');
	const $playerModal = $('#player_modal_layer');
	const $playerContainer = $('#player_container');
	const $seperator = $('#seperator');
	const PLAYER_DIVS = [$playerContainer, $playerModal, $seperator];

	const Results = {
		init(vids, vidsPerChunk) {
			this.vidsPerChunk = vidsPerChunk;
			this.allResults = vids;
			this.chunks = this.resultsToEuqalLengthChunks(this.allResults, this.vidsPerChunk);

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
		let timeout;

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

			switch (key) {
				case ENTER:
					this.startVideo($currentSelected);
					break;
				case LEFT_A:
					this.navigateLeftFrom($currentSelected);
					break;
				case UP_A:
					this.navigateUpFrom($currentSelected);
					break;
				case RIGHT_A:
					this.navigateRightFrom($currentSelected);
					break;
				case DOWN_A:
					this.navigateDownFrom($currentSelected);
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
			clearInterval(timeout);

			let $fig = $(e.currentTarget);
			let delay = this.userSettings['time_to_play'] * 1000;

			timeout = setTimeout(() => {
				this.startVideo($fig)
			}, delay);
		}

		const mouseoutHandler = function(e) {
			clearInterval(timeout);
		}

		const togglePlayerDivs = () => {
			PLAYER_DIVS.forEach(($div) => $div.toggle());
		}

		return {
			results: null,
			playerManager: null,
			userSettings: null,

			init(query) {
				this.chunkN = 0;
				this.getTemplates();
				this.initializeSearch(query);
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
				$contentDiv.on('mouseover', 'figure', mouseInHandler.bind(this));
				$contentDiv.on('mouseout', 'figure', mouseoutHandler.bind(this));
			},
			initializeSearch(query) {
				let searchCallback = this.searchAndHandleResults.bind(this, query);

				this.getUserSettings(searchCallback)
			},
			getUserSettings(callback) {
				let callbacks = [this.assignUserSettings.bind(this), callback];

				$.ajax({
					url: 'user_settings'
				}).done(callbacks);
			},
			assignUserSettings(response) {
				let settings = DEFAULT_SETTINGS;

				if (response) {
					settings = JSON.parse(response);
					Object.keys(settings).forEach((key) => settings[key] = parseInt(settings[key], 10));
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
				this.appendNextChunkToContent();
				this.selectFirstFigure();
				this.scrollToTopRowSelection();
			},
			setCSSProperties() {
				let settings = this.userSettings;
				let figWidth = FIGURE_WIDTHS[settings['col_number']];
				let figHeight = FIGURE_HEIGHTS[settings['row_number']];
				let figFont = FIGURE_FONT_SIZE[settings['row_number']];
				let figPadding = FIGURE_PADDING[settings['row_number']];

				document.body.style.setProperty('--figureWidth', figWidth);
				document.body.style.setProperty('--figureHeight', figHeight);
				document.body.style.setProperty('--figureFont', figFont || '0.8rem');
				document.body.style.setProperty('--figurePadding', figPadding || '5%');
			},
			appendNextChunkToContent() {
				let vids = this.results.getChunk(this.chunkN);
				let html = this.thumbTemplate({ vids }).replace('-->', '');
				$contentDiv.append(html);

				this.chunkN += 1;
			},
			selectFirstFigure() {
				let $first = this.figures(0);

				this.selectFigure($first);
			},
			selectFigure($element) {
				$('.selected').removeClass('selected');
				$element.addClass('selected');

				this.scrollToSelectedRow();
			},
			navigateLeftFrom($fig) {
				let $next = $fig.next();

				if (empty($next)) {
					$next = this.figures(0);
				}

				this.selectFigure($next);
			},
			navigateRightFrom($fig) {
				let $next = $fig.prev();

				if (empty($next)) {
					$next = this.figures(-1);
				}

				this.selectFigure($next);
			},
			navigateUpFrom($fig) {
				let rowLength = this.userSettings['col_number'];
				let figuresOnPage = this.figures().length;
				let nextIdx = ($fig.index() - rowLength) % figuresOnPage;
				let $next = this.figures(nextIdx);

				this.selectFigure($next);
			},
			navigateDownFrom($fig) {
				let rowLength = this.userSettings['col_number'];
				let figuresOnPage = this.figures().length;
				let nextIdx = ($fig.index() + rowLength);
				let $next = this.figures(nextIdx);

				if (empty($next)) {
					if (this.moreResultsAvailable()) {
						this.appendNextChunkToContent();
						this.navigateDownFrom($fig);
						return;
					} else {
						nextIdx = ($fig.index() + rowLength) % figuresOnPage;
						$next = this.figures(nextIdx);
					}
				}

				this.selectFigure($next);
			},
			scrollToSelectedRow() {
				let $figure = $('.selected');
				let figTop = $figure.offset().top;
				let height = parseInt($figure.css('height'), 10);
				let figBottom = figTop + height;

				let scrollTop = document.documentElement.scrollTop;
				let pageBottomY = scrollTop + window.innerHeight;

				if (this.topFigureNotAligned($figure)) {
					this.scrollToTopRowSelection();
				} else if (this.bottomFigureNotAligned($figure)) {
					this.scrollToBottomRowSelection();
				}
			},
			scrollToTopRowSelection() {
				let paddingMult = parseInt(FIGURE_PADDING[this.userSettings['row_number']], 10) * 0.01;
				let $figure = $('.selected');
				let figTop = $figure.offset().top;
				let contentHeight = parseInt($('#content').css('height'), 10);

				document.documentElement.scrollTop = (figTop - (contentHeight * paddingMult));
			},
			scrollToBottomRowSelection() {
				let paddingMult = parseInt(FIGURE_PADDING[this.userSettings['row_number']], 10) * 0.01;
				let $figure = $('.selected');
				let figTop = $figure.offset().top;
				let figHeight = parseInt($figure.css('height'), 10);
				let figBottom = figTop + figHeight;
				let contentHeight = parseInt($('#content').css('height'), 10);

				document.documentElement.scrollTop = (figBottom + (contentHeight * paddingMult) - window.innerHeight);
			},
			topFigureNotAligned($fig) {
				let figTop = $fig.offset().top;

				return document.documentElement.scrollTop > figTop;
			},
			bottomFigureNotAligned($fig) {
				let figTop = $fig.offset().top;
				let figHeight = parseInt($fig.css('height'), 10);
				let figBottom = figTop + figHeight;

				return document.documentElement.scrollTop + window.innerHeight < figBottom;
			},
			moreResultsAvailable() {
				return this.results.getChunk(this.chunkN) !== undefined;
			},
			startVideo($vid) {
				let vidId = $vid.data('vid_id');
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
				let $figures = $('figure');

				if (n === undefined) {
					return $figures;
				}

				return $figures.eq(n);
			},
		};
	})();

	const urlParams = new URLSearchParams(window.location.search);
	const searchQuery = encodeURI(urlParams.get('q'));

	Object.create(Page).init(searchQuery);
});