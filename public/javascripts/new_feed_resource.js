$(function() {
	$fields = $('#fields');

	const QUERY_STRINGS = {
		playlist: 'q_type=playlist_info&max_results=1&q_param=',
		channel: 'q_type=chan_info&max_results=1&q_param=',
		video: 'q_type=vid_info&max_results=1&q_param=',
	}

	const HREF = {
		playlist: '/results?listId=',
		channel: '/results?chanId=',
		video: '/results?vidId=',
		search: '/results?query=',
	}

	const RESOUCE_SELECTION_TEXT = {
		search: 'מוסג חיפוש',
		playlist: 'הדבק לינק לרשימה',
		channel: 'הדבק לינק לערוץ',
		video: 'הדבק לינק לסרטון',
	}

	const getResourceId = (resource, type) => {
		switch (type) {
			case 'playlist':
				return resource.split('list=')[1];
			case 'channel':
				return resource.split('/channel/')[1];
			case 'video':
				return resource.split('?v=')[1];
			default:
				return resource;
		}
	}

	const craftLink = (resourceId, type) => {

	}

	const aClick = function(e) {
		e.preventDefault();

		this.type = $(e.target).data('type');
		this.renderResourceSelection();
	}

	const selectResourceClick = function(e) {
		e.preventDefault();

		let resource = $('input').val();

		this.dealWithResource(resource);
	}

	const resource = {
		exportObj: {},
		templates: {},

		init() {
			this.getTemplates();
			this.bindEvents();
			this.displayHome();
		},
		getTemplates() {
			let that = this;

			$('[type="text/handlebars-x"]').each(function() {
				let tempName = $(this).attr('id').replace('_template', '');

				that.templates[tempName] = Handlebars.compile($(this).html());
			});
		},
		bindEvents() {
			$(document.body).on('click', '.type', aClick.bind(this))
			$(document.body).on('click', '#select_resource', selectResourceClick.bind(this));
		},
		displayHome() {
			let html = this.templates.type_selection();
			$fields.html(html);
		},
		renderResourceSelection() {
			let label = RESOUCE_SELECTION_TEXT[this.type];
			let html = this.templates.resource_selection({ label });
			$fields.html(html);
		},
		dealWithResource(resource) {
			let resourceId = getResourceId(resource, this.type);

			this.checkValidiyGetImage(resourceId)
					.then(() => {
						this.exportObj.href = HREF[this.type] + resourceId;

						if (this.type === 'search') {
							this.renderImageSelector();
							return;
						}

						this.saveAndPreview();
					})
					.fail(() => alert('הלינק המבוקש אינו תקין'));
		},
		saveAndPreview() {
			let that = this;

			this.saveResource()
					.then(function(response) {
						that.renderPreview(response);
					});
		},
		checkValidiyGetImage(resourceId) {
			if (this.type === 'search') {
				return Promise.resolve();
			}

			let queryString = QUERY_STRINGS[this.type] + resourceId;
			let that = this;

			return $.ajax({
				url: '/youtube_resource',
				data: queryString,
				dataType: 'json',
			}).then(function(response) {
				if (response.items.length === 0) {
					return Promise.reject();
				}

				that.logToExport(response.items[0]);
			});
		},
		saveResource() {
			return $.ajax({
				data: JSON.parse(this.exportObj);
			});
		},
		logToExport(item) {
			this.exportObj.title = item.snippet.title;
			this.exportObj.img = item.snippet.thumbnails.medium.url;
		},
	};

	Object.create(resource).init();
})