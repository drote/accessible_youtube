'use strict';

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

$(function() {
	// JQUERY VARIABLES
	const $body = $(document.body);
	const $content = $('#content');
	const $playerContainer = $('#player_container');
	const $seperator = $('#seperator');
	const $headerP = $('header > p');
	const $querySpan = $('#query');
	const $logo = $('#logo');
	const $templates = $('[type="text/handlebars-x"]');
	const $mainAndHeader = $('main, header');

	const PLAYER_DIVS = [$playerContainer, $seperator];

	const ajaxCall = function(url, data) {
		return $.ajax({ url, data })
						.then((data) => data);
	}

	// RESULTS MANAGER
	const ResultsManager = (function() {
		const MAX_ALLOWED_VIDEOS = 100;
		const makeQueryString = (queryParams) => {
			let params = [];

			Object.keys(queryParams).forEach((param) => {
				if (queryParams[param]) {
					params.push(`${param}=${queryParams[param]}`);
				}
			});

			return encodeURI(params.join('&'));
		}

		const youtubeResource = function(q_type, max_results, q_param, search_embeddable, token) {
			let queryString = makeQueryString({ q_type, max_results, q_param, search_embeddable, token });

			return $.ajax({
				url: `/youtube_resource`,
				data: queryString
			});
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
			allResults: null,
			query: null,
			queryType: null,
			maxResults: null,
			searchEmbeddable: null,
			nextPageToken: null,

			init(query, queryType, vidsPerPage, searchEmbeddable) {
				this.queryType = queryType;
				this.maxResults = vidsPerPage;
				this.query = query;
				this.searchEmbeddable = searchEmbeddable;
				this.allResults = [];

				return this;
			},
			getResults(more) {
				let that = this;
				let token;

				if (more) {
					token = this.nextPageToken;
				}

				return youtubeResource(this.queryType, this.maxResults, this.query, this.searchEmbeddable, token)
							 .then(function(response) {
							   that.addResults(response.items, response.nextPageToken);
							 });
			},
			getPlaylistInfo(id) {
				return youtubeResource('playlist_info', '1', id);
			},
			getVidInfo(id) {
				return youtubeResource('vid_info', '1', id);
			},
			getChannelInfo(id) {
				return youtubeResource('chan_info', '1', id);
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
		const DEFAULT_SETTINGS_URL = '/api/default_user_settings';
		const SETTINGS_URL = '/api/user_settings/';
		let playTimeout;
		let selectTimeout;
		let clickTimeout;

		const CSS_FONT_SIZES = {
			'5': '0.6rem',
			'4': '0.8rem',
			'3': '0.8rem',
			'2': '1rem',
			'1': '1.4rem',
		};

		const arrowKeys = {
			'37': 'left',
			'38': 'up',
			'39': 'right',
			'40': 'down',
		};

		const navCharCodeToKey = {
			'33': 'pageUp',
			'34': 'pageDown',
			'13': 'enter',
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
			'82': 'r',
			'89': 'y',
			...arrowKeys,
		};

		const QUERY_TYPES = {
			'query': 'search',
			'listId': 'playlist',
			'chanId': 'channel',
			'relatedToVidId': 'related_videos',
			'vidId': 'direct_play',
		}

		const empty = ($elm) => $elm.length === 0;
		const activeAnimation = ($elm) => $elm.find('.progress_circle').length !== 0;
		const getFigureHieght = (rowNum) => `${90 / rowNum}%`;
		const getFigureWidth = (colNum) => `${90 / colNum}%`;
		const getAnimationLength = (delayTime) => `${delayTime / 1000}s`;
		const getMainHeaderWidth = (controlsWidth) => `${100 - controlsWidth}%`;
		const getCotrolsWidth = (controlsWidth) => `${controlsWidth}%`;
		const getFontSize = (rowNum) => CSS_FONT_SIZES[rowNum];

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

		const togglePlayerContent = (bool) => {
			PLAYER_DIVS.forEach(($div) => $div.toggle(bool));
			$content.toggle(!bool);
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
			templates: {},
			queryType: null,
			query: null,
			resultsManager: null,
			playerManager: null,
			navigationManager: null,
			userSettings: null,
			userId: null,
			gazeBreak: false,

			init() {
				this.getTemplates();
				this.bindEvents();
				this.getParams();

				if (this.directPlay()) {
					this.playVidFromParams();
				} else {
					this.searchVidsProtocol();
				}

				return this;
			},
			searchVidsProtocol() {
				this.initSettings()
						.then(() => this.initResults())
						.then(() => {
							this.initDisplay();
							this.initNavigationManager();
						});
			},
			getTemplates() {
				let that = this;

				$templates.each(function() {
					let $temp = $(this);
					if ($temp.hasClass('partial')) {
						Handlebars.registerPartial($temp.attr('id'), $temp.html());
					}

					that.templates[$temp.attr('id')] = Handlebars.compile($temp.html());
				});

				$templates.remove();
			},
			bindEvents() {
				$body.on('keydown', keydownHandler.bind(this));
				$content.on('mouseenter', '.wrapper', vidMouseIn.bind(this));
				$content.on('mouseleave', '.wrapper', vidMouseOut.bind(this));
				$content.on('click', '.wrapper', vidClick.bind(this));
			},
			getParams() {
				const urlParams = new URLSearchParams(window.location.search);
				this.userId = $('#user_id').html();

				for (let pair of urlParams.entries()) {
					this.queryType = QUERY_TYPES[pair[0]];
					this.query = pair[1];
				}

				$('[type="var"]').remove();
			},
			directPlay() {
				return this.queryType === 'direct_play';
			},
			initSettings() {
				const that = this;

				return this.getUserSettings()
									 .then(function(response) {
									 	  that.assignSettings(response);
									 	  that.checkStartGazeBreak();
										});
			},
			assignSettings(settings) {
				this.userSettings = settingsJsonToObj(settings);
			},
			checkStartGazeBreak() {
				if (this.gaRestMode()) {
					this.startGazeBreak();
				}
			},
			playVidFromParams() {
				this.startVideo(null, this.query);
			},
			initResults() {
				this.resultsManager = Object.create(ResultsManager)
																		.init(this.query, this.queryType, this.vidsPerPage(), this.searchEmbeddable());

				return this.resultsManager.getResults();
			},
			initDisplay() {
				feather.replace();

				this.currentPageNumber = 0;
				this.setCSSProperties();
				this.pushMainAndHeader(this.controlsFloat());
				this.initHeader();
				this.renderPageNumber(0);
				this.selectWrapper(0);
			},
			useDefaultSettings() {
				let that = this;

				return ajaxCall(DEFAULT_SETTINGS_URL)
							 .then(function(response) {
							   that.assignSettings(response);
							 });
			},
			initNavigationManager() {
				this.navigationManager = Object.create(NavigationManager).init(this.colNumber(), this.rowNumber());
			},
			getUserSettings() {
				return ajaxCall(`${SETTINGS_URL}${this.userId}`);
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
					'--controlsFloat': this.controlsFloat(),
				});
			},
			pushMainAndHeader(controlsFloat) {
				if (controlsFloat === 'right') {
					$mainAndHeader.css('left', 0);
					return;
				}

				$mainAndHeader.css('right', 0);
			},
			initHeader() {
				switch (this.queryType) {
					case 'playlist':
						this.setupPlaylistHeader();
						break;
					case 'channel':
						this.setupChannelHeader();
						break;
					case 'related_videos':
						this.setupRelatedVidsHeader();
						break;
					default:
						this.setupSearchHeader();
				}
			},
			setupPlaylistHeader() {
				let infoFunc = this.resultsManager.getPlaylistInfo;
				let template = this.templates.playlist_header_template;

				this.getInfoSetHeader(infoFunc, template);
				// let that = this;

				// this.resultsManager.getPlaylistInfo(this.query)
				// 		.then(function(data) {
				// 			that.adjustHeaderContent(data.items[0], that.templates.playlist_header_template);
				// 		});
			},
			setupChannelHeader() {
				let infoFunc = this.resultsManager.getChannelInfo;
				let template = this.templates.channel_header_template;

				this.getInfoSetHeader(infoFunc, template);
				// let that = this;

				// this.resultsManager.getChannelInfo(this.query)
				// 		.then(function(data) {
				// 			that.adjustHeaderContent(data.items[0], that.templates.channel_header_template);
				// 		});
			},
			setupRelatedVidsHeader() {
				let infoFunc = this.resultsManager.getVidInfo;
				let template = this.templates.related_vids_header_template;

				this.getInfoSetHeader(infoFunc, template);
				let that = this;

				this.resultsManager.getVidInfo(this.query)
						.then(function(data) {
							that.adjustHeaderContent(data.items[0], that.templates.related_vids_header_template);
						});
			},
			getInfoSetHeader(infoFunc, template) {
				let that = this;
				infoFunc(this.query).then(function(data) {
					that.adjustHeaderContent(data.items[0], template);
				});
			},
			adjustHeaderContent(data, template) {
				let title = data.title || data.snippet.title;
				let html = template(data);

				$('.header_content.center').html(html);
				$('title').text(`D-Bur Tube (${title})`);
			},
			setupSearchHeader() {
				this.adjustHeaderContent({title: this.query}, this.templates.search_header_template);
			},
			renderPageNumber(n) {
				let vids = this.resultsManager.getResultPage(n);
				let html = this.templates.thumbnails_template({ vids }).replace('-->', '');

				$content.empty();
				$content.append(html);

				let rightMarginPcent = this.colNumber() === 1 ? '5%' : '2.5%';
				$(`.wrapper:visible:nth-of-type(${this.colNumber()}n)`).css('margin-left', '0');
				$(`.wrapper:visible:nth-of-type(${this.colNumber()}n + 1)`).css('margin-right', rightMarginPcent);

				this.currentPageNumber = n;
			},
			selectWrapper(idx) {
				$('.selected:visible').removeClass('selected');
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
			startVideo($wrapper, vidId) {
				vidId = vidId || $wrapper.find('figure').data('vid_id');

				if (this.openInYoutube()) {
					window.open(`https://www.youtube.com/watch?v=${vidId}`);
					return;
				}

				togglePlayerContent(true);
				this.playVidWhenPlayerReady(vidId);

				this.checkStartGazeBreak();
			},
			playVidWhenPlayerReady(vidId) {
				setTimeout(() => {
					if (playerReady) {
						if (this.firstVideo()) {
							this.assignPlayer();
						}

						this.playerManager.playVid(vidId);
						return;
					}

					this.playVidWhenPlayerReady();
				}, 1500);
			},
			firstVideo() {
				return this.playerManager === null;
			},
			assignPlayer(vidId) {
				this.playerManager = playerManager;
				// this.playerManager = Object.create(PlayerManager).init(vidId);
			},
			closePlayer() {
				if (player.getPlayerState() === 1) {
					this.playerManager.stopVid();
				}

				togglePlayerContent(false);
			},
			playMode() {
				return $playerContainer.is(':visible');
			},
			// relatedVidsMode() {
			// 	return $moreContent.is(':visible');
			// },
			wrappers(n) {
				let $wrappers = $('.wrapper');

				return n === undefined ? $wrappers : $wrappers.eq(n);
			},
			countdownAnimate($elm) {
				if (activeAnimation($elm)) return;

				this.setCSSCircleWidth($elm);
				this.createProgCricleOn($elm)
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
				playTimeout = setTimeout(() => {
					this.startVideo($wrapper);
					this.removeProgressCircle();
				}, playDelay);
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
						$logo.get(0).click();
						break;
					case 'g':
						if (this.gaDisabled()) return;

						this.startGazeBreak();
						break;
					case 'o':
						if (this.gaDisabled()) return;

						this.endGazeBreak();
						break;
					default:
						this.navigate(selectedIdx, key);
				}
			},
			respondToPlayKey(key) {
				if (key === 'escape') {
					this.closePlayer();

					if (this.directPlay()) {
						window.location.href = '/search';
					}

					return;
				} else if (key === 'y') {

					if (player.getPlayerState() === -1) {
						let vidId = player.getVideoData()['video_id'];
						window.open(`https://www.youtube.com/watch?v=${vidId}`);
					}

					return;
				} else if (key === 'r') {
					let vidState = player.getPlayerState();

					if (vidState === 2 || vidState === 0) {
						let vidId = player.getVideoData()['video_id'];
						window.location.href = `/results?relatedToVidId=${vidId}`;
					}

					return;
				}

				this.playerManager.keyHandler(key);
			},
			startGazeBreak() {
				this.gazeBreak = true;
			},
			endGazeBreak() {
				this.gazeBreak = false;
			},
			searchEmbeddable() {
				return this.userSettings['open_in_youtube'] === 'off';
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
			gaRestMode() {
				return this.userSettings['gaze_aware_rest'] === 'on';
			},
			openInYoutube() {
				return this.userSettings['open_in_youtube'] === 'on';
			}
		};
	})();

	Object.create(Page).init();
});