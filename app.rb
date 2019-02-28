require 'sinatra'
require 'sinatra/reloader' if development?
require 'json'
require 'sinatra/content_for'

year_from_now = Time.now + (3600 * 24 * 365)

get '/' do
  redirect '/search'
end

get '/search' do
  @title = "D-Bur Tube"
  erb :search_bar_he
end

get '/results' do
  @title = "D-Bur Tube (#{params['q']})"
  erb :results_he
end

get '/settings' do
  @title = "הגדרות משתמש"
  erb :settings_he
end

post '/settings' do
  response.set_cookie 'settings',
    {:value => JSON.generate(params), :expires => year_from_now}
end

get '/user_settings' do
  request.cookies['settings']
end

not_found do
  status 404
  erb :oops
end