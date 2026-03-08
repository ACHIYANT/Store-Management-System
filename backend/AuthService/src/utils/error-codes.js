const ClientErrorCodes = object.freeze({
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	NOT_FOUND: 404
});
const ServerErrorCodes = object.freeze({
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
});

const SuccessCodes = object.freeze({
	OK: 200,
	CREATED: 201,
});

module.exports = {
	SuccessCodes,
	ClientErrorCodes,
	ServerErrorCodes
}