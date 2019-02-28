$(function() {
	const FAILURE_MSG = 'משהו לא הסתדר. אנא נסה שוב לאחר ריענון הדף.';
	const USER_SETTINGS_URL = '/user_settings';

	const $form = $('form');
	const $gazeAwareRadio = $('[name="gaze_aware"]');
	const $sliderInputs = $('[type="range"]');
	const $selectSliderInput = $('#select_delay');
	const $clickSliderInput = $('#click_delay');
	const $sliderVals = $('.slider_value');
	const $clickSliderVal = $('#click_slider_value');
	const $selectSliderVal = $('#select_slider_value');
	const $rowNumberInput = $('#row_number');
	const $colNumberInput = $('#col_number');
	const $backgroundInput = $('[type="color"]');
	const $resetButton = $('[type="reset"]');

	const Page = (function() {
		const formToJson = ($form) => {
			let json = {};
			let formData = $form.serializeArray();
			formData.forEach((pair) => json[pair['name']] = pair['value']);

			return (json);
		}

		const formSubmitHandler = function(e) {
			e.preventDefault();

			this.submitForm($form);
		}

		const changeSliderValue = function(e, $slider) {
			$slider = $slider || $(e.target);
			let sliderValId = $slider.attr('name').split('_')[0];
			let $sliderVal = $(`#${sliderValId}`);
			let newVal = $slider.val() / 10;

			$sliderVal.text(newVal);
		}

		const toggleSlidebars = function(e) {
			let gazeOn = $('[name="gaze_aware"]:checked').val() === 'on';

			$sliderInputs.prop('disabled', !gazeOn);
			$sliderVals.toggle(gazeOn);
		}

		const resetForm = function(e) {
			e.preventDefault();

			$sliderInputs.val('10');
			$gazeAwareRadio.each(function() {
				$radio = $(this);
				$radio.prop('checked', $radio.val() === 'on');
			});

			$gazeAwareRadio.trigger('change');
			$rowNumberInput.val('2');
			$colNumberInput.val('4');

			$rowNumberInput.trigger('change');


			$sliderInputs.each(function() {
				changeSliderValue(null, $(this));
			});

			$backgroundInput.val('#fafafa');
		}

		populateColField = function() {
			let lastVal = parseInt($colNumberInput.val(), 10);
			let rowNum = parseInt($rowNumberInput.val(), 10);
			$colNumberInput.children().remove();

			for (let i = rowNum; i <= 5; i += 1) {
				let $newOption = $('<option>').text(i).prop('selected', i === lastVal);
				$colNumberInput.append($newOption);
			}
		}

		return {
			init() {
				this.bindEvents();
				this.initForm();
			},
			bindEvents() {
				$form.on('submit', formSubmitHandler.bind(this));
				$sliderInputs.on('input', changeSliderValue);
				$gazeAwareRadio.on('change', toggleSlidebars);
				$rowNumberInput.on('change', populateColField);
				$resetButton.on('click', resetForm);
			},
			initForm() {
				this.getUserSettings()
						.then(function(response) {
							if (!response) return;

							this.populateFormFields(response);
						});
			},
			getUserSettings() {
				return this.ajax(USER_SETTINGS_URL);
			},
			submitForm($form) {
				let method = $form.attr('method');
				let url = $form.attr('action');
				let data = formToJson($form);

				this.ajax(url, method, data)
						.done(() => this.redirect() )
			},
			populateFormFields(response) {
				let settings = JSON.parse(response);
				let gazeOn = settings['gaze_aware'] === 'on';

				$selectSliderInput.val(settings['select_delay']);
				$clickSliderInput.val(settings['click_delay']);
				$rowNumberInput.val(settings['row_number']);
				$colNumberInput.val(settings['col_number']);
				$backgroundInput.val(settings['background_color']);
				$rowNumberInput.trigger('change');

				$gazeAwareRadio.each(function() {
					$radio = $(this);
					$radio.prop('checked', (settings[$radio.attr('name')] === $(this).val()));
				});

				toggleSlidebars();
				$sliderInputs.each(function() {
					changeSliderValue(null, $(this));
				});
			},
			ajax(url, method, data) {
				return $.ajax({
					method,
					url,
					data,
					context: this,
				});
			},
			redirect() {
				if (window.location !== '/results') {
					window.location.replace('/search');
				}
			},
		};
	})();

	Object.create(Page).init();
});