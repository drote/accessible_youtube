$(function() {
	const FORM_ERROR = 'אנא תקן את הפורם';
	const SUCCESS_MSG = 'ההגדרות נשמרו בהצלחה';
	const FAILURE_MSG = 'משהו לא הסתדר. אנא נסה שוב לאחר ריענון הדף.';
	const $form = $('form');
	const $secInput = $('[type="number"]');

	const Page = (function() {
		const formToJson = ($form) => {
			let json = {};
			let formData = $form.serializeArray();
			formData.forEach((pair) => json[pair['name']] = pair['value']);

			return (json);
		}

		const formSubmitHandler = function(e) {
			e.preventDefault();

			if (formInvalid()) {
				alert(FORM_ERROR);
				return;
			}

			this.submitForm($form);
		}

		const formInvalid = () => !fieldValid($secInput);

		const clearError = (($field) => {
			return function() {
				$field.parent().siblings('.error').hide();
			}
		});

		const fieldValid = function($field) {
			return function() {
				if ($field.is(':invalid')) {
					$field.parent().siblings('.error').show();
					return;
				}

				return true;
			}
		}

		return {
			init() {
				this.bindEvents();

				return this;
			},
			bindEvents() {
				$secInput.on('focusout', fieldValid($secInput));
				$secInput.on('focusin', clearError($secInput));
				$form.on('submit', formSubmitHandler.bind(this));
			},
			submitForm($form) {
				$.ajax({
					method: $form.attr('method'),
					url: $form.attr('action'),
					data: formToJson($form),
				}).done(() => alert(SUCCESS_MSG))
					.fail(() => alert(FAILURE_MSG));
			},
		};
	})();

	Object.create(Page).init();
});