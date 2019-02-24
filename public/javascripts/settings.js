$(function() {
	const FORM_ERROR = 'אנא תקן את הפורם';
	const SUCCESS_MSG = 'ההגדרות נשמרו בהצלחה';
	const FAILURE_MSG = 'משהו לא הסתדר. אנא נסה שוב לאחר ריענון הדף.';
	const $form = $('form');
	const $sliderInput = $('[type="range"]');
	const $sliderValue = $('#slider_value');
	const $gazeAwareInput = $('[type="checkbox"]');
	const $rowNumberInput = $('#row_number');
	const $colNumberInput = $('#col_number');
	const $radioInputs = $('[type="radio"]');

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

		const fieldValid = function($field) {
			return function() {
				if ($field.is(':invalid')) {
					$field.parent().siblings('.error').show();
					return;
				}

				return true;
			}
		}

		const changeSliderValue = function() {
			let newVal = $sliderInput.val() / 100;
			$sliderValue.text(newVal);
		}

		const toggleSlideBar = function() {
			if ($sliderInput.is(':disabled')) {
				$sliderInput.prop('disabled', false);
				$sliderInput.trigger('input');
			} else {
				$sliderInput.prop('disabled', true);
				$sliderValue.text('');
			}
		}

		return {
			init() {
				this.bindEvents();
				this.initForm();
			},
			bindEvents() {
				$form.on('submit', formSubmitHandler.bind(this));
				$sliderInput.on('input', changeSliderValue);
				$gazeAwareInput.on('change', toggleSlideBar);
			},
			submitForm($form) {
				$.ajax({
					method: $form.attr('method'),
					url: $form.attr('action'),
					data: formToJson($form),
					context: this,
				}).done(() => {
					alert(SUCCESS_MSG);
					this.redirect();
				}).fail(() => alert(FAILURE_MSG));
			},
			initForm(callback) {
				$.ajax({
					url: 'user_settings',
					context: this,
				}).done((response) => {
					if (response) {
						this.populateFormFields(response);
					}
				});
			},
			populateFormFields(response) {
				let settings = JSON.parse(response);
				let gazeOn = settings['gaze_aware'] === 'on';

				$gazeAwareInput.prop('checked', gazeOn);
				$sliderInput.prop('disabled', !gazeOn);

				if (gazeOn) {
					$sliderInput.val(settings['time_to_play']);
					$sliderInput.trigger('input');
				}

				$rowNumberInput.val(settings['row_number']);
				$colNumberInput.val(settings['col_number']);

				$radioInputs.each(function() {
					$(this).prop('checked', (settings['background_color'] === $(this).val()));
				});
			},
			redirect() {
				if ($('#settings').length !== 0) {
					this.closeMenuBar();
					page.refreshView();
				} else {
					window.location.replace('/search');
				}
			},
			closeMenuBar(){
				$('#settings').animate({width: 0}, 700, function() {
					$('#settings_modal_layer').hide();
					$('#settings').hide();
				});
			},
		};
	})();

	Object.create(Page).init();
});