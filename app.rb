require 'dotenv'
Dotenv.load

require 'sinatra'
require 'sinatra/reloader' if development?
require 'json'
require 'sinatra/content_for'
require 'httparty'
require 'yaml'

DEFAULT_SETTINGS = {
  gaze_aware: 'on',
  gaze_aware_rest: 'on',
  select_delay: '5',  
  click_delay: '15',
  col_number: '4',
  row_number: '3',
  background_color: '#c4c4c4',
  select_color: '#e89999',
  controls_location: 'left',
  controls_width: '18',
  open_in_youtube: 'off',
}

YEAR_FROM_NOW = Time.now + (3600 * 24 * 365)
JSON_DEFAULT_SETTINGS = JSON.generate(DEFAULT_SETTINGS)

YT_ROOT = 'https://www.googleapis.com/youtube/v3'

YT_URLS = {
  'search' => '/search',
  'related_videos' => '/search',
  'playlist' => '/playlistItems',
  'playlist_info' => '/playlists',
  'feed' => '/activities',
  'vid_info' => '/videos',
  'channel' => '/search',
  'chan_info' => '/channels'
}

YT_FILEDS = {
  'search' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high)))',
  'related_videos' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high)))',
  'playlist' => 'nextPageToken,items(snippet(resourceId(videoId),title,description,thumbnails(high(url))))',
  'playlist_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'vid_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'chan_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'channel' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high(url))))',
  'feed' => 'nextPageToken,items',
}

QUERY_PARAMS = {
  'part' => 'snippet',
  'maxResults' => nil,
  'fields' => nil,
}

def make_query(query_type, max_results, query_param, search_embeddable, token)
  query = QUERY_PARAMS.clone
  query['maxResults'] = max_results
  query['fields'] = YT_FILEDS[query_type]

  if query_type != 'feed'
    query['key'] = ENV['YT_API_KEY']
  end

  if token != 'undefined'
    query['pageToken'] = token
  end

  if search_embeddable == 'true'
    query['videoEmbeddable'] = 'true'
  end

  if query_type == 'search'
    query['q'] = CGI::escape(query_param)
    query['order'] = 'viewCount'
  elsif query_type == 'playlist'
    query['playlistId'] = query_param
  elsif query_type == 'related_videos'
    query['relatedToVideoId'] = query_param
  elsif query_type == 'channel'
    query['channelId'] = query_param
    query['order'] = 'date'
  elsif query_type == 'feed'
    query['mine'] = 'true'
    query['access_token'] = query_param
  else
    query['id'] = query_param
  end

  if !query_type.match('info') || query_type != 'feed'
    query['type'] = 'video'
  end

  query.to_a.map { |pair| "#{pair[0]}=#{pair[1]}" }.join('&')
end

def get_url(query_type)
  "#{YT_ROOT}#{YT_URLS[query_type]}"
end

def next_user_id
  users_hash = YAML.load(File.read('public/data/users.yml'))

  if users_hash.empty?
    return 0
  end

  return users_hash.keys.max + 1
end

def set_new_cookie
  user_id = next_user_id
  response.set_cookie('id',
    :value => user_id, :expires => YEAR_FROM_NOW, :secret => ENV['SESSION_SECRET'])

  users_hash = YAML.load(File.read('public/data/users.yml'))
  users_hash[user_id] = {'settings' => nil}
  File.open('public/data/users.yml', 'w') { |file| file.write(users_hash.to_yaml) }
end

def get_yt_refresh_token(user_id)
  users_hash = YAML.load(File.read('public/data/users.yml'))
  users_hash[user_id]['refresh_token']
end

before do
  if !request.cookies['id']
    set_new_cookie
  end
end

get '/' do
  redirect '/search'
end

get '/search' do
  @title = "D-Bur Tube"
  erb :search_he
end

get '/playlist_search' do
  @title = "D-Bur Playlist Search"
  erb :playlist_search_he
end

get '/results' do
  @title = "D-Bur Tube (#{params['q']})"
  @user_id = request.cookies['id']

  erb :results_he
end

get '/settings' do
  @title = "הגדרות משתמש"
  @user_id = request.cookies['id']

  erb :settings_he
end

post '/api/user_settings/:user_id' do
  user_id = params[:user_id].to_i

  settings_hash = Rack::Utils.parse_nested_query(request.body.read)

  users_hash = YAML.load(File.read('public/data/users.yml'))
  users_hash[user_id]['settings'] = JSON.generate(settings_hash)
  File.open('public/data/users.yml', 'w') { |file| file.write(users_hash.to_yaml) }

  status 200
  JSON.generate(settings_hash)
end

get '/api/user_settings/:user_id' do
  user_id = params[:user_id].to_i
  users_hash = YAML.load(File.read('public/data/users.yml'))
  settings = users_hash[user_id]['settings']

  if !settings
    return JSON_DEFAULT_SETTINGS
  end

  settings
end

get '/api/default_user_settings' do
  JSON_DEFAULT_SETTINGS
end

# get '/yt_connect' do
#   user_id = request.cookies['id'].to_i

#   token = request.cookies['yt_token']
#   refresh_token = get_yt_refresh_token(user_id)

#   if token
#     redirect to("/results?token=#{token}")
#   elsif refresh_token
#     query = {
#       'client_id' => CGI::escape(ENV['YT_CLIENT_ID']),
#       'redirect_uri' => CGI::escape('http://localhost:4567/yt_connect'),
#       'refresh_token' => refresh_token,
#       'grant_type' => 'refresh_token'
#     }

#     yt_response = HTTParty.post('http://accounts.google.com/o/oauth2/token', {body: form})
#     expiration = Time.now + yt_response['expires_in'].to_i / 10

#     bindind.pry

#     response.set_cookie('yt_token',
#       { :value => yt_response['access_token'], :expires => expiration, :secret => ENV['SESSION_SECRET'] })

#     redirect '/yt_connect'
#   elsif params['code']
#     form = {
#       'code' => (params['code']),
#       'client_id' => ENV['YT_CLIENT_ID'],
#       'client_secret' => ENV['YT_CLIENT_SECRET'],
#       'redirect_uri' => 'http://localhost:4567/yt_connect',
#       'grant_type' => 'authorization_code',
#     }

#     yt_response = HTTParty.post('http://accounts.google.com/o/oauth2/token', {body: form})

#     expiration = Time.now + yt_response['expires_in'].to_i / 10

#     users_hash = YAML.load(File.read('public/data/users.yml'))
#     users_hash[user_id]['refresh_token'] = yt_response['refresh_token']
#     File.open('public/data/users.yml', 'w') { |file| file.write(users_hash.to_yaml) }

#     response.set_cookie('yt_token',
#       { :value => yt_response['access_token'], :expires => expiration, :secret => ENV['SESSION_SECRET'] })

#     redirect '/yt_connect'
#   else
#     query = {
#       'client_id' => CGI::escape(ENV['YT_CLIENT_ID']),
#       'redirect_uri' => CGI::escape('http://localhost:4567/yt_connect'),
#       'response_type' => 'code',
#       'scope' => 'https://www.googleapis.com/auth/youtube.readonly',
#       'access_type' => 'offline',
#     }

#     string_q = query.to_a.map { |pair| "#{pair[0]}=#{pair[1]}" }.join('&')
#     puts URI.escape(string_q)
#     redirect "https://accounts.google.com/o/oauth2/auth?#{string_q}"
#   end
# end

get '/youtube_resource' do
  query_type = params['q_type']
  max_results = params['max_results']
  query_param = params['q_param']
  search_embeddable = params['search_embeddable']
  token = params['token']

  query_string = make_query(query_type, max_results, query_param, search_embeddable, token)
  url = get_url(query_type)

  redirect "#{url}?#{query_string}"
end

not_found do
  status 404
  erb :oops
end

error 403 do
  'The requested resource cannot be found'
end