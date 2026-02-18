/*
Work in progress for test auto completes.
*/

// ================================================
// INTERCEPT ALL CALLS TO api/graphql3?query=getSubmission-knowledgeCheckConsumption-mutation:reportAssessmentDuration GraphQL
// ================================================

const originalXHR = XMLHttpRequest.prototype;
const originalFetch = window.fetch;

console.log('%c🔍 graphql3 interceptor ENABLED', 'color:#89b4fa; font-size:16px; font-weight:bold');

// 1. Hook XMLHttpRequest (most common for GraphQL in Percipio)
const oldOpen = originalXHR.open;
originalXHR.open = function (method, url) {
	if (typeof url === 'string' && url.includes('api/graphql3?query=getSubmission-knowledgeCheckConsumption-mutation:reportAssessmentDuration')) {
		console.log('%c📡 INTERCEPTED XHR → graphql3', 'color:orange; font-weight:bold', {
			method,
			url
		});
		this._isActiveChallenge = true;
	}
	return oldOpen.apply(this, arguments);
};

const oldSend = originalXHR.send;
originalXHR.send = function (body) {
	if (this._isActiveChallenge) {
		console.log('%c📦 Request Body:', 'color:#f9e2af', body);

		// Optional: You can modify the body here before it is sent
		// Example: body = body.replace(...);

		this.addEventListener('load', function () {
			try {
				const response = JSON.parse(this.responseText);
				console.log('%c✅ Response from graphql3:', 'color:#a6e3a1', response);

				// Optional: Modify response before the page sees it
				// this.responseText = JSON.stringify(modifiedResponse);
			} catch (e) {}
		});
	}
	return oldSend.apply(this, arguments);
};
async function streamToString(stream) {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let result = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		// Decode the Uint8Array chunk and append it to the result string
		result += decoder.decode(value, {
			stream: true
		});
	}

	// Final decode call to handle any pending multi-byte characters
	result += decoder.decode();
	return result;
}

// 2. Hook fetch() (in case Percipio uses modern fetch)
window.fetch = async function (input, init) {
	const url = typeof input === 'string' ? input : input.url || '';

	if (url.includes('api/graphql3?query=getSubmission-knowledgeCheckConsumption-mutation:reportAssessmentDuration')) {
		console.log('%c📡 INTERCEPTED fetch → graphql3', 'color:orange; font-weight:bold', {
			url,
			init
		});

		// Log request body
		if (init && init.body) {
			console.log('%c📦 Request Body (fetch):', 'color:#f9e2af', init.body);
		}

		const response = await originalFetch(input, init);
		const cloned = response.clone();
		const text = await streamToString(cloned.body);
		console.log('%c✅ Response from graphql3 (fetch):', 'color:#a6e3a1', text);
		const STORAGE_KEY = 'percipio_answers_db';
		const raw = localStorage.getItem(STORAGE_KEY);
		let storageAnswers = raw ? JSON.parse(raw) : {};
		try {
			let courseId = document.location.pathname.split('/')[2];
			storageAnswers[courseId] = storageAnswers[courseId] ?? {};
			let courseAnswers = storageAnswers[courseId];
			let submission = JSON.parse(text)[0].data.submission;
			let questionId = submission.assessmentsChallengeQuestionUuid;
			courseAnswers[questionId] = submission.correctedChoices;

			localStorage.setItem(STORAGE_KEY, JSON.stringify(storageAnswers, null, 2));

		} catch (e) {
			debugger;
		}

		return response;
	}

	return originalFetch(input, init);
};

console.log('%c✅ Interceptor is now active. All calls to graphql3 will be logged.', 'color:#89b4fa');

const CONFIG = {
	questionContainer: 'div.QuestionContent---root---Jxi0l',
	questionStem: 'div.QuestionMessages---stem---UdCrK',
	optionItem: 'li.MultipleChoice---choice---yl4GH',
	optionTextContainer: 'div.MultipleChoice---choiceText---OmAtz',
	radioInput: 'input[type="radio"]',
	checkboxInput: 'input[type="checkbox"]',
	submitButton: 'button[data-marker="LP.assessments.verify"], div.Question---verifyButton---dBxWZ button',
	nextButton: 'button[data-marker="LP.assessments.next"]',
	finishButton: 'button[data-marker="LP.assessments.finish"]',
	reviewIndicator: 'div.MessageBar---messageBarRoot---m2nHs',
	correctSelector: 'div.QuestionContent---root---Jxi0l .ValidationMessage---correct---D5mTD'
};

setInterval(function () {
	const container = document.querySelector(CONFIG.questionContainer);
	if (!container)
		return false;
	const firstRadio = container.querySelector(CONFIG.radioInput);
	let clickButton = false;
	if (firstRadio) {
		if (!firstRadio.checked) {
			firstRadio.click();
			clickButton = true;
		}
	} else {
		const checkboxes = container.querySelectorAll(CONFIG.checkboxInput);

		checkboxes.forEach(cb => {
			if (!cb.checked) {
				clickButton = true;
				cb.click();
			}
		});
	}
	if (clickButton) {
		safeClick(CONFIG.submitButton, 'Submit');
	} else {
		safeClick('button[data-marker="LP.assessments.next"], .Question---nextButton---kq5mF button', 'Next');
	}
}, 300)

function safeClick(selector, name = 'button', maxWait = 500) {
	const start = Date.now();
	while (Date.now() - start < maxWait) {
		const btn = document.querySelector(selector);
		if (btn) {
			if (typeof btn.checkVisibility === 'function') {
				if (btn.checkVisibility({
						checkOpacity: true,
						checkVisibilityCSS: true
					})) {
					console.log(`✅ ${name} visible via checkVisibility() – clicking`);
					btn.click();
					return true;
				}
			} else {
				const style = window.getComputedStyle(btn);
				const rect = btn.getBoundingClientRect();
				if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.3 && rect.width > 10 && rect.height > 10) {
					console.log(`✅ ${name} visible (fallback) – clicking`);
					btn.click();
					return true;
				}
			}
		}

	}
	console.log(`⚠️ ${name} never became visible`);
	return false;
}
