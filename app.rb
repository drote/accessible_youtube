require 'sinatra'
require 'sinatra/reloader' if development?
require 'json'
require 'sinatra/content_for'

DEFAULT_SETTINGS = {
  gaze_aware: 'on',
  click_delay: '5',
  select_delay: '15',
  col_number: '4',
  row_number: '3',
  background_color: '#c4c4c4',
  select_color: '#e89999',
  controls_location: 'right',
  controls_width: '10',
}

YEAR_FROM_NOW = Time.now + (3600 * 24 * 365)
JSON_DS = JSON.generate(DEFAULT_SETTINGS)

get '/' do
  redirect '/search'
end

get '/search' do
  @title = "D-Bur Tube"
  erb :search_he
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
    {:value => JSON.generate(params), :expires => YEAR_FROM_NOW}
end

get '/user_settings' do
  settings = request.cookies['settings'] || JSON_DS

  settings
end

get '/default_settings' do
  JSON_DS
end

get '/yt_connect' do
  erb :yt_connect_he

not_found do
  status 404
  erb :oops
end