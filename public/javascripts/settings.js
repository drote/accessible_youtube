// const DEFAULT_FORM_VALUES = {
// 	gaze_aware: 'on',
// 	select_delay: '10',
// 	click_delay: '10',
// 	row_number: '2',
// 	col_number: '4',
// 	background_color: '#fafafa',
// 	select_color: '#b22222',
// }

const FAILURE_MSG = 'משהו לא הסתדר. אנא נסה שוב לאחר ריענון הדף.';
const USER_SETTINGS_URL = '/user_settings';
const DEFAULT_SETTINGS_URL = '/default_settings'

$(function() {
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
	const $backgroundInput = $('[name="background_color"]');
	const $selectColorInput = $('[name="select_color"]');
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

		const sliderChangeHandler = function(e) {
			$slider = $(e.target);

			this.changeSliderNumberValue($slider);
		}

		const radioInputChange = function(e) {
			let toggleOn = $('[name="gaze_aware"]:checked').val() === 'on';

			this.toggleSlideBars(toggleOn);
		}

		const resetForm = function(e) {
			e.preventDefault();

			this.resetForm();
		}

		return {
			init() {
				this.bindEvents();
				this.initForm();
			},
			bindEvents() {
				$form.on('submit', formSubmitHandler.bind(this));
				$sliderInputs.on('input', sliderChangeHandler.bind(this));
				$gazeAwareRadio.on('change', radioInputChange.bind(this));
				$resetButton.on('click', resetForm.bind(this));
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
			getDefaultSettings() {
				return this.ajax(DEFAULT_SETTINGS_URL);
			},
			submitForm($form) {
				let method = $form.attr('method');
				let url = $form.attr('action');
				let data = formToJson($form);

				this.ajax(url, method, data)
						.done(() => this.redirect() )
			},
			resetForm() {
				this.getDefaultSettings()
						.then(function(response) {
							this.populateFormFields(response);
						});
			},
			populateFormFields(response) {
				let settings = JSON.parse(response);

				this.setFormValues(settings);
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
			changeSliderNumberValue($slider) {
				let sliderValId = $slider.attr('name').split('_')[0];
				let $sliderVal = $(`#${sliderValId}`);
				let newVal = $slider.val() / 10;

				$sliderVal.text(newVal);
			},
			setFormValues({ gaze_aware, select_delay, click_delay, row_number,
											col_number, background_color, select_color }) {
				let ga_active = gaze_aware === 'on';

				this.setRadioInput(gaze_aware);
				this.setSliderValues(select_delay, click_delay);
				this.setRowColValues(row_number, col_number);
				this.setColorInputs(background_color, select_color);
				this.toggleSlideBars(ga_active);
				this.setSliderNumValues();
			},
			toggleSlideBars(bool) {
				$sliderInputs.prop('disabled', !bool);
				$sliderVals.toggle(bool);
			},
			setRadioInput(onOff) {
				$gazeAwareRadio.each(function() {
					$radio = $(this);
					$radio.prop('checked', $radio.val() === onOff);
				});
			},
			setRowColValues(rowN, colN) {
				$rowNumberInput.val(rowN);
				$colNumberInput.val(colN);
			},
			setSliderValues(selectDelay, clickDelay) {
				$selectSliderInput.val(selectDelay);
				$clickSliderInput.val(clickDelay);
			},
			setSliderNumValues() {
				let that = this;

				$sliderInputs.each(function() {
					that.changeSliderNumberValue($(this));
				});
			},
			setColorInputs(bgColor, slctColor) {
				$backgroundInput.val(bgColor);
				$selectColorInput.val(slctColor);
			},
		};
	})();

	Object.create(Page).init();
});