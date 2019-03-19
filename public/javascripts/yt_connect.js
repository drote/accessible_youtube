const CLIENT_ID = '503897726469-pbj57f0m9jjvf1vbc2gkvo5h8resc191.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';


feather.replace();
const $authorizeButton = $('#authorize-button');
const $signoutButton = $('#signout-button');

function handleClientLoad() {
	gapi.load('client:auth2', initClient);
}

function updateSigninStatus(isSignedIn) {
	if (isSignedIn) {
		window.location = '/results?feed'
	} else {
		$authorizeButton.show();
		$signoutButton.hide();
	}
}

function handleAuthClick() {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
	gapi.auth2.getAuthInstance().signOut();
}

function initClient() {
	gapi.client.init({
		discoveryDocs: DISCOVERY_DOCS,
		clientId: CLIENT_ID,
		scope: SCOPES,
	}).then(() => {
		gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
		updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
		$authorizeButton.on('click', handleAuthClick);
		$signoutButton.on('click', handleSignoutClick);
	});
}
