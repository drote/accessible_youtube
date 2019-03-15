require 'pry'

require 'dotenv'
Dotenv.load

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

YT_ROOT = 'https://www.googleapis.com/youtube/v3'

YT_URLS = {
  'search' => '/search',
  'relatedVideos' => '/search',
  'playlist' => '/playlistItems',
  'playlist_info' => '/playlists',
  'vid_info' => '/videos',
  'channel' => '/search',
  'chan_info' => '/channels'
}

YT_FILEDS = {
  'search' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high)))',
  'relatedVideos' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high)))',
  'playlist' => 'nextPageToken,items(snippet(resourceId(videoId),title,description,thumbnails(high(url))))',
  'playlist_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'vid_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'chan_info' => 'items(snippet(title,description,thumbnails(medium(url))))',
  'channel' => 'nextPageToken,items(id(videoId),snippet(title,description,thumbnails(high(url))))',
}

QUERY_PARAMS = {
  'part' => 'snippet',
  'maxResults' => nil,
  'fields' => nil,
  'order' => 'viewCount',
  'key' => ENV['YT_API_KEY'],
}

def make_query(query_type, max_results, query_param, token)
  query = QUERY_PARAMS.clone
  query['maxResults'] = max_results
  query['fields'] = YT_FILEDS[query_type]

  if token != 'undefined'
    query['pageToken'] = token
  end

  if query_type == 'search'
    query['q'] = query_param
  elsif query_type == 'playlist'
    query['playlistId'] = query_param
  elsif query_type == 'relatedVideos'
    query['relatedToVideoId'] = query_param
  elsif query_type == 'channel'
    query['channelId'] = query_param
    query['order'] = 'date'
  else
    query['id'] = query_param
  end

  if !query_type.match('info')
    query['type'] = 'video'
  end

  query.to_a.map { |pair| "#{pair[0]}=#{pair[1]}" }.join('&')
end

def get_url(query_type)
  "#{YT_ROOT}#{YT_URLS[query_type]}"
end

use Rack::Session::Cookie, :key => "rack.session",
                           :path => "/",
                           :secret => ENV['SESSION_SECRET'],
                           :expires_after => YEAR_FROM_NOW

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
  erb :results_he
end

get '/settings' do
  @title = "הגדרות משתמש"
  erb :settings_he
end

post '/settings' do
  if session['settings']
    settings = JSON.parse(session['settings'])
    settings = settings.merge(params)
  else
    settings = params
  end

  session['settings'] = JSON.generate(settings)
end

get '/user_settings' do
  settings = session['settings'] || JSON_DS

  settings
end

get '/default_settings' do
  JSON_DS
end

get '/yt_connect' do
  erb :yt_connect_he
end

get '/youtube_resource' do
  query_type = params['q_type']
  max_results = params['max_results']
  query_param = params['q_param']
  token = params['token']

  query_string = make_query(query_type, max_results, query_param, token)
  url = get_url(query_type)

  redirect "#{url}?#{query_string}"
end

not_found do
  status 404
  erb :oops
end