// Light NC Sign: public sign-up is off. A new _User can only be created with the master key
// (the owner account at deploy, or a server function that has already checked who is asking).
// This also blocks REST `POST /users` and account creation through any auth adapter.
export default function UserBeforeSave(request) {
  if (!request.master && !request.original) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sign-up is turned off.');
  }
}
