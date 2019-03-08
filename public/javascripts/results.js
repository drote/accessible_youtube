'use strict';

$(function() {
	// JQUERY VARIABLES
	const $body = $(document.body);
	const $contentDiv = $('#content');
	const $playerModal = $('#player_modal_layer');
	const $playerContainer = $('#player_container');
	const $seperator = $('#seperator');
	const $querySpan = $('#query');
	const $logo = $('#logo');
	const PLAYER_DIVS = [$playerContainer, $playerModal, $seperator];


	const ajaxCall = function(url, data) {
		return $.ajax({ url, data }).then((data) => data);
	}

	// RESULTS MANAGER
	const ResultsManager = (function() {
		const YT_SEARCH_URL = '/search';
		const YT_PLAYLIST_URL= '/playlistItems';
		const YT_API_KEY = 'AIzaSyD0HiZ1FdFt3QK10ndUBUfddC6hyj19IW8';
		const YT_SEARCH_FIELDS = 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high)))';
		const YT_PLAYLIST_FIELDS = 'nextPageToken,items(snippet(resourceId(videoId),title,description,thumbnails(high(url))))';
		const MAX_ALLOWED_VIDEOS = 100;

		const makeQueryString = (requestParams) => {
			let params = [];

			Object.keys(requestParams).forEach((prm) => {
				params.push(`${prm}=${requestParams[prm]}`);
			});

			return encodeURI(`${params.join('&')}`);
		}

		const parseForTemplate = (vid) => {
			let obj = {};
			let vidId;

			if (vid.id) {
				vidId = vid.id.videoId;
			} else {
				vidId = vid.snippet.resourceId.videoId;
			}

			obj['id'] = vidId;
			obj['img'] = vid.snippet.thumbnails.high.url;
			obj['title'] = vid.snippet.title;
			obj['description'] = vid.snippet.description;

			return obj;
		}

		return {
			allResults: [],
			urlRoot: 'https://www.googleapis.com/youtube/v3',
			url: null,
			nextPageToken: null,

			requestParams: {
				key: YT_API_KEY,
				part: 'snippet',
				maxResults: null,
				fields: null,
				type: null,
				order: 'viewCount',
			},

			init(query, queryType, vidsPerPage) {
				this.initRequestParams(query, queryType, vidsPerPage);
				this.initUrl(queryType);

				return this;
			},
			initRequestParams(query, queryType, vidsPerPage) {
				if (queryType === 'searchQuery') {
					this.requestParams['q'] = query;
					this.requestParams.fields = YT_SEARCH_FIELDS;
				} else {
					this.requestParams['playlistId'] = query;
					this.requestParams['fields'] = YT_PLAYLIST_FIELDS;
				}

				this.requestParams.type = 'video';
				this.requestParams.maxResults = vidsPerPage;
			},
			initUrl(queryType) {
				let address = YT_SEARCH_URL;

				if (queryType === 'playlistVideos') {
					address = YT_PLAYLIST_URL;
				}

				this.url = this.urlRoot + address;
			},
			getResults(more) {
				let that = this;

				if (more) {
					this.requestParams['pageToken'] = this.nextPageToken;
				}

				let queryString = makeQueryString(this.requestParams);

				return this.fetch(queryString)
									 .then(function(response) {
									 	 that.addResults(response.items, response.nextPageToken);
									 });
			},
			getPlaylistInfo(id) {
				let plInfoRequestParams = {
					id,
					key: YT_API_KEY,
					part: 'snippet',
					maxResults: '1',
					fields: 'items(snippet(title,description,thumbnails(medium(url))))',
				};

				let url = this.urlRoot + '/playlists';
				let queryString = makeQueryString(plInfoRequestParams);

				return ajaxCall(url, queryString);
			},
			fetch(queryString) {
				return ajaxCall(this.url, queryString);
			},
			addResults(vids, nextPageToken) {
				this.allResults.push(vids.map(parseForTemplate));
				this.nextPageToken = nextPageToken;
			},
			getResultPage(n) {
				return this.allResults[n];
			},
			nOfPages() {
				return this.allResults.length;
			},
			nOfResults() {
				return this.allResults.map((page) => page.length)
									 .reduce((sum, current) => sum + current);
			},
			noMoreResults() {
				return !this.nextPageToken;
			},
			outOfQuota() {
				return this.nOfResults() >= MAX_ALLOWED_VIDEOS;
			}
		};
	})();


	//PLAYER MANAGER
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


	//NAVIGATION MANAGER
	const NavigationManager = (function() {
		const directionToChange = {
			left() {
				return 1;
			},
			right() {
				return -1;
			},
			up() {
				return -this.colNumber;
			},
			down() {
				return this.colNumber;
			},
			pageDown() {
				return this.vidsPerPage;
			},
			pageUp() {
				return -this.vidsPerPage;
			},
		}

		return {
			init(colNumber, rowNumber) {
				this.colNumber = parseInt(colNumber, 10);
				this.rowNumber = parseInt(rowNumber, 10);
				this.vidsPerPage = this.colNumber * this.rowNumber;

				return this;
			},
			nextIdxAndPage(idx, direction) {
				let change = directionToChange[direction].call(this);
				let nextIdx = idx + change;
				let maxAllowedIdx = this.vidsPerPage - 1;
				let page = 'current';

				if (nextIdx > maxAllowedIdx) {
					nextIdx = this.nextOutOfBoundsIdx(idx, direction);
					page = 'next';
				} if (nextIdx < 0) {
					nextIdx = this.nextOutOfBoundsIdx(idx, direction);
					page = 'prev';
				}

				return { nextIdx, page };
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
			idxAcrossPage(idx, direction) {
				let compensation = ((this.rowNumber - 1) * this.colNumber);

				if (direction === 'down') {
					compensation = -compensation;
				}

				return idx + compensation;
			},
		};
	})();


	//PAGE OBJECT
	const Page = (function() {
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
			'71': 'g',
			'79': 'o',
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

		let playTimeout;
		let selectTimeout;
		let clickTimeout;


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

		const directionToChange = {
			left() { return 1; },
			right() { return -1; },
			up() { return -this.colNumber(); },
			down() { return this.colNumber(); },
			pageDown() { return this.vidsPerPage(); },
			pageUp() { return -this.vidsPerPage(); },
		}

		const empty = ($elm) => $elm.length === 0;
		const activeAnimation = ($elm) => $elm.find('.progress_circle').length !== 0;
		const getFigureHieght = (rowNum) => `${90 / rowNum}%`;
		const getFigureWidth = (colNum) => `${90 / colNum}%`;
		const getBackgroundColor = (color) => color;
		const getAnimationLength = (delayTime) => `${delayTime / 1000}s`;
		const getMainHeaderWidth = (controlsWidth) => `${100 - controlsWidth}%`;
		const getCotrolsWidth = (controlsWidth) => `${controlsWidth}%`;
		const getControlsFloat = (float) => float;
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

		return {
			params: null,
			queryType: null,
			resultsManager: null,
			playerManager: null,
			navigationManager: null,
			userSettings: null,
			thumbTemplate: null,
			gazeBreak: false,

			init() {
				this.getTemplates();
				this.bindEvents();
				this.getParams();
				this.initSettings()
						// .then(() => this.initRequestParams())
						.then(() => this.initResults())
						.then(() => {
							this.initDisplay();
							this.initNavigationManager();
						});

				return this;
			},
			getTemplates() {
				Handlebars.registerPartial('vid_thumb_partial', $('#vid_thumb_partial').html());
				this.thumbTemplate = Handlebars.compile($('#thumbnails_template').html());
				this.playlistHeaderTemplate = Handlebars.compile($('#playlist_header_template').html());

				$('[type="text/handlebars-x"]').remove();
			},
			bindEvents() {
				$body.on('keydown', keydownHandler.bind(this));
				$contentDiv.on('mouseenter', '.wrapper', vidMouseIn.bind(this));
				$contentDiv.on('mouseleave', '.wrapper', vidMouseOut.bind(this));
				$contentDiv.on('click', '.wrapper', vidClick.bind(this));
			},
			getParams() {
				const urlParams = new URLSearchParams(window.location.search);

				for (let pair of urlParams.entries()) {
					this.params = pair;
				}

				if (this.params[0] === 'q') {
					this.queryType = 'searchQuery';
				} else {
					this.queryType = 'playlistVideos';
				}
			},
			initSettings() {
				const that = this;

				return this.getUserSettings()
									 .then(function(response) {
											that.userSettings = settingsJsonToObj(response);
										});
			},
			initResults() {
				this.resultsManager = Object.create(ResultsManager).init(this.params[1], this.queryType, this.vidsPerPage());
				return this.resultsManager.getResults();s
			},
			initDisplay() {
				feather.replace();

				this.currentPageNumber = 0;
				this.setCSSProperties();
				this.initHeader();
				this.renderPageNumber(0);
				this.selectWrapper(0);
			},
			initNavigationManager() {
				this.navigationManager = Object.create(NavigationManager).init(this.colNumber(), this.rowNumber());
			},
			getUserSettings() {
				return ajaxCall(SETTINGS_URL);
			},
			getMoreResults() {
				return this.resultsManager.getResults('more');
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
					'--mainAndHeaderWidth': getMainHeaderWidth(this.controlsWidth()),
					'--controlsWidth': getCotrolsWidth(this.controlsWidth()),
					'--controlsFloat': getControlsFloat(this.controlsFloat()),
				});

				this.pushMainAndHeader(this.controlsFloat());
			},
			pushMainAndHeader(controlsFloat) {
				let $mainAndHeader = $('main, header');
				if (controlsFloat === 'right') {
					$mainAndHeader.css('left', 0);
				} else {
					$mainAndHeader.css('right', 0);
				}
			},
			initHeader() {
				if (this.playlistResults()) {
					this.setupPlaylistHeader();
					return;
				}

				$querySpan.text(this.params[1]);
			},
			setupPlaylistHeader() {
				let that = this;

				this.resultsManager.getPlaylistInfo(this.params[1]).then(function(data) {
						let plHeaderHTML = that.playlistHeaderTemplate(data.items[0]);
						$('.header_content.center').html(plHeaderHTML);
				});
			},
			playlistResults() {
				return this.queryType === 'playlistVideos';
			},
			renderPageNumber(n) {
				let vids = this.resultsManager.getResultPage(n);
				let html = this.thumbTemplate({ vids }).replace('-->', '');

				$contentDiv.empty();
				$contentDiv.append(html);

				let rightMarginPcent = this.colNumber() === 1 ? '5%' : '2.5%';
				$(`.wrapper:nth-of-type(${this.colNumber()}n)`).css('margin-left', '0');
				$(`.wrapper:nth-of-type(${this.colNumber()}n + 1)`).css('margin-right', rightMarginPcent);

				this.currentPageNumber = n;
			},
			selectWrapper(idx) {
				$('.selected').removeClass('selected');
				let $wrapper = this.wrappers(idx);

				if (empty($wrapper)) {
					$wrapper = this.wrappers(0);
				}

				$wrapper.addClass('selected');
			},
			renderNextPage() {
				this.renderPageNumber(this.currentPageNumber + 1);
			},
			renderPrevPage() {
				this.renderPageNumber(this.currentPageNumber - 1);
			},
			lastPage(page) {
				return page === this.resultsManager.nOfPages() - 1;
			},
			firstPage(page) {
				return page === 0;
			},
			navigate(idx, direction) {
				let navObj = this.navigationManager.nextIdxAndPage(idx, direction);
				let nextIdx = navObj.nextIdx;
				switch (navObj.page) {
					case 'next':
						this.goToNextPage(nextIdx);
						break;
					case 'prev':
						this.goToPrevPage(nextIdx);
						break;
					default:
						this.selectWrapper(nextIdx);
				}
			},
			goToNextPage(nextIdx) {
				if (this.lastPage(this.currentPageNumber)) {
					if (this.searchOver()) return;

					this.queryAndDisplayNextPage(nextIdx);
					return;
				}

				this.renderNextPage();
				this.selectWrapper(nextIdx);
			},
			goToPrevPage(nextIdx) {
				if (this.firstPage(this.currentPageNumber)) return;

				this.renderPrevPage();
				this.selectWrapper(nextIdx);
			},
			queryAndDisplayNextPage(nextIdx) {
				this.getMoreResults()
						.then(() => {
							this.renderNextPage();
							this.selectWrapper(nextIdx);
						});
			},
			searchOver() {
				return this.resultsManager.outOfQuota() || this.resultsManager.noMoreResults();
			},
			gaDisabled() {
				return this.userSettings['gaze_aware'] === 'off';
			},
			gaInactive() {
			 	return this.gaDisabled() || this.onGazeBreak();
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
					case 'g':
						this.startGazeBreak();
						break;
					case 'o':
						this.endGazeBreak();
						break;
					default:
						this.navigate(selectedIdx, key);
				}
			},
			respondToPlayKey(key) {
				if (key === 'escape') {
					this.closePlayer();
					return;
				}

				this.playerManager.keyHandler(key);
			},
			startGazeBreak() {
				if (this.gaDisabled()) return;

				this.gazeBreak = true;
			},
			endGazeBreak() {
				if (this.gaDisabled()) return;

				this.gazeBreak = false;
			},
			onGazeBreak() {
				return this.gazeBreak;
			},
			vidsPerPage() {
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
			},
			controlsWidth() {
				return this.userSettings['controls_width'];
			},
			controlsFloat() {
				return this.userSettings['controls_location'];
			},
		};
	})();

	Object.create(Page).init();
});