require 'sinatra'
require 'sinatra/reloader' if development?
require 'json'

enable :sessions
set :session_secret, 'secret'

get '/search' do
  erb :search_bar_he
end

get '/results' do
  erb :results_he
end

get '/settings' do
  erb :settings_he
end

post '/settings' do
  session['settings'] = JSON.generate(params)
  puts session['settings']
end

get '/user_settings' do
  session['settings']
end