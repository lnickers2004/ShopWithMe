/***
 * Author: Valerio Gheri
 * Date: 25/03/2013
 * This class contains all the methods to handle /api/lists related requests
 */

var ShoppingList = require('../models/ShoppingList');
var Account = require('../models/Account');
var winston = require('winston');
var ShoppingListRepository = require('../repositories/shoppingListRepository');
var AccountRepository = require('../repositories/accountRepository');
var logger = require('../utils/logger');

var ShoppingListHandler = function() {
	this.createShoppingList = handleCreateShoppingListRequest;	
	this.getShoppingLists = handleGetShoppingListsRequest;
	this.getShoppingList = handleGetShoppingListRequest;
	this.updateShoppingList = handleUpdateShoppingListRequest;
	this.deleteShoppingList = handleDeleteShoppingListRequest;
};

// On success should return status code 201 to notify the client the account
// creation has been successful
// On error should return status code 500 and the error message
function handleCreateShoppingListRequest(req, res) {
	var createdBy = req.body.userId || null;
	var opts = {};
	var title;
	var shoppingListRepository = new ShoppingListRepository();
	if (req.params.id) {
		// It means we want to create a list from a template
		// Find the template list by id
		shoppingListRepository.findById(req.params.id)
		.then(
			function(template) {
				if (template) {
					// Ok template found. Am I authorised to use this template?
					// TODO!
					title = template.title;
					opts = {
						isShared: template.isShared,
						invitees: template.invitees,
						shoppingItems: template.shoppingItems
					};
					shoppingListRepository.createShoppingList(createdBy, title, opts)
						.then(function(shoppingList) {
							if (shoppingList) {
								logger.log('info', 'User Id ' + createdBy + ' has just created a ' +
									'new shopping list from template with id ' + req.params.id + ' . Request from address ' +
									req.connection.remoteAddress + '.');
								res.json(201, shoppingList);
							}
							else {
								// No user could be found. Return 404
								logger.log('info', 'User id ' + createdBy + ' could not be found.' +
									' Remote address: ' + req.connection.remoteAddress);
								res.json(404, {
									error: "User not found"
								});
							}
						});
				}
				else {
					// No template could be found. Return 404
					logger.log('info', 'User id ' + createdBy + ' tried to create a new ' +
						'shopping list from template with id ' + req.params.id + ' but no such id could be found.' +
						' Remote address: ' + req.connection.remoteAddress);
					res.json(404, {
						error: "Template not found"
					});
				}
			})
			.fail(function (err) {
				logger.log('error', 'An error has occurred while processing a request to create a ' +
					'shopping list from ' + req.connection.remoteAddress + '. Stack trace: ' + err.stack);
				res.json(400, {
					error: err.message
				});
			});
	} // We want to create an empty shopping list
	else {
		title = req.body.title || null;	
		// createShoppingList handles creation of all lists, both empty ones
		// and pre-populated ones
		opts = {
			isShared: false,
			invitees: [],
			shoppingItems: []
		};
		shoppingListRepository.createShoppingList(createdBy, title, opts)
		.then(
				function (shoppingList) {
					if (shoppingList) {
						logger.log('info', 'User Id ' + createdBy + ' has just created a ' +
							'new empty shopping list. Request from address ' + req.connection.remoteAddress + '.');
						res.json(201, shoppingList);
					}
					else {
						// No user could be found. Return 404
						logger.log('info', 'User id ' + createdBy + ' could not be found.' +
							' Remote address: ' + req.connection.remoteAddress);
						res.json(404, {
							error: "User not found"
						});
					}
				}
			)
			.fail(function (err) {
				logger.log('error', 'An error has occurred while processing a request to create a ' +
					'shopping list from ' + req.connection.remoteAddress + '. Stack trace: ' + err.stack);
				res.json(400, {
					error: err.message
				});
			});
	}	
}

/// Retrieve the list of shopping lists (not templates) saved, created by the user, or shared with him.
/// If isTemplate is true, then retrieves the list of templates created by this user
/// Url: /api/profiles/:userId/lists
/// Query parameters: isTemplate (1/0)
function handleGetShoppingListsRequest(req, res) {
	var userId = req.params.userId || null;
	var query = req.query;
	// If we have a query, it means we want to retrieve templates
	if (query && query.isTemplate) {
		handleGetTemplateListsForUserRequest(req, res, userId);
	}
	else {
		handleGetListsForUserRequest(req, res, userId);
	}
}

/// Retrieve a shopping list (also a template) for a certain user
/// Url: /api/profiles/:userId/lists/:shoppingListId
function handleGetShoppingListRequest(req, res) {
	var userId = req.params.userId || null;
	var shoppingListId = req.params.shoppingListId || null;
	var accountRepository = new AccountRepository();
	if (userId && shoppingListId) {
		// 1: Retrieve the user object
		accountRepository.findById(userId)
		.then(function(account) {
			if (account) {
				// 2: If the user exists, check if the list id belongs to the list of shoppingLists for this user
				if (account.shoppingLists.indexOf(shoppingListId) > -1 ) {
					// If yes, retrieve the list by id and serve it to the client
					var shoppingListRepository = new ShoppingListRepository();
					return shoppingListRepository.findById(shoppingListId);
				}
				else {
					// If no, return HTTP 404 not found
					logger.log('info', 'Could not find shopping list ' + shoppingListId + ' for user ' + userId +
						'. Request from address ' + req.connection.remoteAddress + '.');
					res.json(404, {
						error: "Not found"
					});
				}
			}
			else {
				// 3: Else If the user doesn't exist -> 404
				logger.log('info', 'Could not retrieve shopping list ' + shoppingListId +
					', for user ' + userId + '. No such user id exists. Request from address ' + req.connection.remoteAddress + '.');
				res.json(404, {
					error: "No account found matching id " + userId
				});
			}
		})
		.then(function(shoppingList) {
			if (shoppingList) {
				logger.log('info', 'User ' + userId + ' retrieved shopping list ' + shoppingListId + '. ' +
					'Request from address ' + req.connection.remoteAddress + '.');
				res.json(200, shoppingList);
			}
			else {
				// 3: Else If the user doesn't exist -> 404
				logger.log('info', 'Could not retrieve shopping list ' + shoppingListId +
					', for user ' + userId + '. No such user shopping list exists. Request from address ' + req.connection.remoteAddress + '.');
				res.json(404, {
					error: "No account found matching id " + userId
				});
			}
		})
		.fail(function(err) {
			res.json(500, {
				error: err.message
			});
			logger.lsog('error', 'An error has occurred while processing a request ' +
				' to retrieve shopping list with id ' + shoppingListId + ' for user ' + userId + ' from ' +
				req.connection.remoteAddress + '. Stack trace: ' + err.stack);
		});
	}
	else {
		// 400 BAD REQUEST
		logger.log('info', 'Bad request from ' +
			req.connection.remoteAddress + '. Message: ' + err.message);
		res.json(400);
	}
}

/// TODO: Check if the user has this shopping list id in the shoppingLists array and if the user is the creator of this list
function handleUpdateShoppingListRequest(req, res) {
	// Retrieve the shopping list id from the request
	var id = req.params.id || null;
	var parameters = req.body || null;
	var shoppingListRepository = new ShoppingListRepository();
	if (id) {
		shoppingListRepository.updateShoppingList(id, parameters)
		.then(function(shoppingList) {
				if (shoppingList) {
					logger.log('info', 'Shopping list ' + id + ' has been updated.' +
						'Request from address ' + req.connection.remoteAddress + '.');
					res.json(200, shoppingList);
				}
				else {
					logger.log('info', 'Could not update shopping list ' + id +
						', no such id exists. Request from address ' + req.connection.remoteAddress + '.');
					res.json(404, {
						error: "No shopping list found matching id " + id
					});
				}
			},
		function(err) {
			if (err.isBadRequest) {
				logger.log('info', 'Bad request from ' +
					req.connection.remoteAddress + '. Message: ' + err.message);
				res.json(400, {
					error: err.message
				});
			}
			else {
				logger.log('error', 'An error has occurred while processing a request ' +
					' to update shopping list with id ' + id + ' from ' +
					req.connection.remoteAddress + '. Stack trace: ' + err.stack);
				res.json(500, {
					error: err.message
				});
			}
		});
	}
}

/// TODO: Check if the user has this shopping list id in the shoppingLists array and if the user is the creator of this list. If yes, then remove the id from the list
function handleDeleteShoppingListRequest(req, res) {
	var listId = req.params.id || null;
	var shoppingListRepository = new ShoppingListRepository();
	shoppingListRepository.deleteShoppingList(listId)
	.then(function(shoppingList) {
			if (shoppingList) {
				logger.log('info', 'Shopping list ' + listId + ' has been deleted.' +
					'Request from address ' + req.connection.remoteAddress + '.');
				// No need to return anything. We just deleted the list
				res.json(204, null);
			}
			else {
				logger.log('info', 'Could not delete shopping list ' + listId + ', no ' +
					'such id exists. Request from address ' + req.connection.remoteAddress + '.');
				res.json(404, {
					error: "No shopping list found matching " + listId
				});
			}
		},
	function (err) {
		logger.log('error', 'An error has occurred while deleting shopping list ' + listId +
			' from ' + req.connection.remoteAddress +
			'. Stack trace: ' + err.stack);
		res.json(500, {
			error: err.message
		});
	});
}

// Returns 404 both for a not existing user and for an empty result set
function handleGetTemplateListsForUserRequest(req, res, userId) {
	var shoppingListRepository = new ShoppingListRepository();
	shoppingListRepository.findTemplatesListsForUser(userId)
	.then(
		function(templates) {
			if (templates && templates.length > 0) {
				logger.log('info', 'Successfully retrieved templates for user ' + userId +
					'. Request from address ' + req.connection.remoteAddress + '.');
				res.json(200, templates);
			}
			else {
				logger.log('info', 'No template list for user ' + userId +
					'. Request from address ' + req.connection.remoteAddress + '.');
				res.json(404, templates);
			}
		},
		function(err) {
			logger.log('error', 'An error has occurred while processing a request to ' +
				'retrieve template lists for user ' + userId + ' from ' + req.connection.remoteAddress +
				'. Stack trace: ' + err.stack);
			res.json(500, {
				error: err.message
			});
		}
	);
}

// Returns 404 for a not existing user and for an empty result set
function handleGetListsForUserRequest(req, res, userId) {
	var accountRepository = new AccountRepository();
	var shoppingListRepository = new ShoppingListRepository();
	accountRepository.findById(userId)
	.then(function(account) {
			if (account) {
				// get the list of shopping list IDs for the user
				var listIDs = account.shoppingLists;
				// then do a find on the shoppingLists collection to look for the IDs retrieved
				// filtered by isActive = true and isTemplate = false
				var query = {
					"_id": { $in: listIDs },
					isActive: true,
					isTemplate: false
				};
				return shoppingListRepository.find(query);
			}
		})
	.then(function(lists) {
			if (lists && lists.length > 0) {
				logger.log('info', 'Successfully retrieved shopping lists for user ' + userId +
					'. Request from address ' + req.connection.remoteAddress + '.');
				res.send(200, lists);
			}
			else {
				logger.log('info', 'No shopping list for user ' + userId +
					'. Request from address ' + req.connection.remoteAddress + '.');
				res.json(404, null);
			}
		})
	.fail(function(err) { //catches all errors
			logger.log('error', 'An error has occurred while processing a request to ' +
				'retrieve shopping lists for user ' + userId + ' from ' + req.connection.remoteAddress +
				'. Stack trace: ' + err.stack);
			res.json(500, {
				error: err.message
			});
		});
}

module.exports = ShoppingListHandler;
