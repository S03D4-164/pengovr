import os
import tempfile
import json as json_module
import gzip
import hashlib
import base64
from invisible_playwright.async_api import InvisiblePlaywright
from s3_client import S3Client
from image_utils import image_to_base64

async def pw_worker(data):
    """
    invisible_playwright Async版を使用してWebサイトをスクレイピングし、
    スクリーンショット、リクエスト/レスポンス、結果をS3に保存
    """
    s3 = S3Client()
    job_id = data.get('id', 'unknown')
    webpage_id = data.get('webpageId', job_id)
    
    try:
        # ジョブデータから情報を取得
        url = data.get('url')
        
        if not url:
            raise ValueError("URL is required in job data")
        
        print(f"[pwWorker] Starting job {job_id} for URL: {url}")
        
        # ネットワークトラッキング用の配列
        requests_list = []
        responses_list = []
        payloads_collector = []
        response_cache = {}  # URL + status_code -> body キャッシュ
        
        # 非同期ブラウザコンテキストを作成（invisible_playwright版）
        async with InvisiblePlaywright() as browser:
            # Xvfb環境でブラウザを起動
            context = await browser.new_context()
            page = await context.new_page()
            
            # リクエスト監視用の関数
            async def handle_request(request):
                try:
                    # ヘッダーを取得
                    headers_dict = dict(request.headers) if hasattr(request, 'headers') else {}
                    
                    # ドット含むヘッダーキーをエスケープ（MongoDB対応）
                    newHeaders = {}
                    for key in headers_dict:
                        new_key = key.replace('.', '\uff0e') if '.' in key else key
                        newHeaders[new_key] = headers_dict[key]
                    
                    req_data = {
                        '_id': hashlib.md5(os.urandom(12)).hexdigest()[:24],
                        'url': request.url,
                        'method': request.method,
                        'resourceType': request.resource_type,
                        'headers': newHeaders,
                    }
                    
                    # POSTデータがあれば取得
                    if hasattr(request, 'post_data'):
                        req_data['postData'] = request.post_data
                    
                    requests_list.append(req_data)
                    print(f"[pwWorker] Captured Request: {request.method} {request.url[:80]}")
                except Exception as e:
                    print(f"[pwWorker] Error handling request: {e}")
            
            # レスポンス監視用の関数
            async def handle_response(response):
                try:
                    # URLのハッシュを計算
                    url_hash = hashlib.md5(response.url.encode()).hexdigest()
                    
                    # ヘッダーを取得
                    headers_dict = dict(response.headers) if hasattr(response, 'headers') else {}
                    
                    # ドット含むヘッダーキーをエスケープ（MongoDB対応）
                    newHeaders = {}
                    for key in headers_dict:
                        new_key = key.replace('.', '\uff0e') if '.' in key else key
                        newHeaders[new_key] = headers_dict[key]
                    
                    res_data = {
                        '_id': hashlib.md5(os.urandom(12)).hexdigest()[:24],
                        'url': response.url,
                        'urlHash': url_hash,
                        'status': response.status,
                        'statusText': response.status_text or '',
                        'ok': response.ok,
                        'headers': newHeaders,
                        'mimeType': headers_dict.get('content-type'),
                        'encoding': headers_dict.get('content-encoding'),
                        'remoteAddress': {},
                    }
                    
                    # remoteAddressを取得（サーバーアドレス情報）
                    # URLからホスト情報を抽出してDNS解決
                    remote_address = {}
                    try:
                        from urllib.parse import urlparse
                        import socket
                        
                        parsed_url = urlparse(response.url)
                        hostname = parsed_url.hostname
                        
                        if hostname:
                            try:
                                server_ip = socket.gethostbyname(hostname)
                                remote_address = {
                                    'ip': server_ip,
                                    'port': parsed_url.port or (443 if parsed_url.scheme == 'https' else 80),
                                }
                                print(f"[pwWorker] DEBUG: Resolved {hostname} to {server_ip}")
                            except socket.gaierror as e:
                                print(f"[pwWorker] DEBUG: Could not resolve {hostname}: {e}")
                                # フォールバックなし
                    except Exception as e:
                        print(f"[pwWorker] WARNING: Could not get remote address: {type(e).__name__}: {e}")
                    
                    res_data['remoteAddress'] = remote_address
                    
                    # レスポンスボディとテキストを取得
                    response_body = None
                    response_text = None
                    
                    # キャッシュから取得を試みる
                    cache_key = f"{response.url}:{response.status}"
                    if cache_key in response_cache:
                        response_body = response_cache[cache_key]['body']
                        if response_body:
                            try:
                                response_text = response_body.decode('utf-8', errors='replace')
                            except Exception as e:
                                print(f"[pwWorker] Warning: Could not decode body: {e}")
                    
                    # テキストをレスポンスに追加（サイズ制限あり：10MB）
                    if response_text:
                        size_limit = 10 * 1024 * 1024  # 10MB
                        res_json_size = len(json_module.dumps(res_data))
                        if res_json_size > size_limit:
                            print(f"[pwWorker] Response body for {response.url[:80]} is too large and will be dropped")
                        else:
                            res_data['text'] = response_text
                    else:
                        pass  # テキストなし
                    
                    # ペイロード処理（レスポンスボディをS3に保存）
                    if response_body and len(response_body) < 5 * 1024 * 1024:  # 5MB以下
                        payload_md5 = hashlib.md5(response_body).hexdigest()
                        
                        # ペイロードをS3に保存
                        payload_key = f"webpages/{webpage_id}/payloads/{payload_md5}"
                        s3.upload_buffer(response_body, payload_key, res_data['mimeType'] or 'application/octet-stream')
                        
                        # ペイロード参照を追加
                        payload_data = {
                            '_id': payload_md5[:24],
                            'md5': payload_md5,
                            's3Key': payload_key,
                        }
                        
                        # 重複チェック
                        if not any(p['md5'] == payload_md5 for p in payloads_collector):
                            payloads_collector.append(payload_data)
                        
                        res_data['payload'] = payload_data['_id']
                    
                    # セキュリティ詳細情報を取得（HTTPS対応）
                    try:
                        sec_details = await response.security_details()
                        if sec_details:
                            res_data['securityDetails'] = {
                                'issuer': sec_details.get('issuer'),
                                'protocol': sec_details.get('protocol'),
                                'subjectName': sec_details.get('subjectName'),
                                'validFrom': sec_details.get('validFrom'),
                                'validTo': sec_details.get('validTo'),
                            }
                    except Exception as e:
                        print(f"[pwWorker] Warning: Could not get security details: {e}")
                    
                    responses_list.append(res_data)
                    print(f"[pwWorker] Captured Response: {response.status} {response.url[:80]}")
                except Exception as e:
                    print(f"[pwWorker] Error handling response: {e}")
            
            # イベントリスナーを登録（ページ読み込み前に）
            print(f"[pwWorker] Setting up event listeners...")
            
            # すべてのリクエスト/レスポンスをインターセプトしてキャッシュする
            async def handle_route(route):
                try:
                    response = await route.fetch()
                    cache_key = f"{response.url}:{response.status}"
                    
                    # レスポンスボディを取得してキャッシュ
                    try:
                        body = await response.body()
                        response_cache[cache_key] = {
                            'body': body,
                            'status': response.status,
                            'url': response.url,
                            'headers': dict(response.headers) if hasattr(response, 'headers') else {},
                        }
                        print(f"[pwWorker] Cached response: {response.status} {response.url[:80]} ({len(body)} bytes)")
                    except Exception as e:
                        print(f"[pwWorker] Warning: Could not cache body: {e}")
                    
                    # Route.continue_()はresponseパラメータなし
                    await route.continue_()
                except Exception as e:
                    print(f"[pwWorker] Warning: Route handler error: {e}")
                    await route.continue_()
            
            # すべてのリクエストにルートハンドラーをセット
            await page.route('**/*', handle_route)
            
            page.on('request', handle_request)
            page.on('response', handle_response)
            
            # ページを開く
            print(f"[pwWorker] Loading page...")
            await page.goto(url, wait_until='domcontentloaded')
            print(f"[pwWorker] Page goto complete. Requests so far: {len(requests_list)}, Responses: {len(responses_list)}")
            
            # 追加のネットワーク完了を待つ
            print(f"[pwWorker] Waiting for network to be idle...")
            try:
                await page.wait_for_load_state('networkidle', timeout=30000)
            except Exception as e:
                print(f"[pwWorker] Network idle timeout (continuing anyway): {e}")
            
            print(f"[pwWorker] Page loaded. Captured {len(requests_list)} requests and {len(responses_list)} responses")
            
            # 一時ファイルにスクリーンショットを保存
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                screenshot_path = tmp_file.name
            
            # スクリーンショットを撮影
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"[pwWorker] Screenshot saved locally: {screenshot_path}")
            
            # スクリーンショットをS3にアップロード
            screenshot_s3_key = f"webpages/{webpage_id}/screenshots/screenshot.png"
            s3.upload_file(screenshot_path, screenshot_s3_key)
            print(f"[pwWorker] Screenshot uploaded to S3: {screenshot_s3_key}")
            
            # スクリーンショットのバッファを取得（MD5計算用）
            with open(screenshot_path, 'rb') as f:
                screenshot_buffer = f.read()
            
            screenshot_md5 = hashlib.md5(screenshot_buffer).hexdigest()
            
            # サムネイル（リサイズ＆base64）を生成
            thumbnail_base64 = image_to_base64(screenshot_path, resize=True)
            print(f"[pwWorker] Thumbnail generated (base64 length: {len(thumbnail_base64)})")
            
            # ローカルファイルを削除
            os.remove(screenshot_path)
            
            # ページタイトルを取得
            try:
                page_title = await page.title()
            except:
                page_title = ''
            
            # ページのコンテンツを取得（オプション）
            try:
                page_content = await page.content()
            except:
                page_content = ''
            
            # ブラウザを閉じる
            await browser.close()
            
            # スクレイピング結果メタデータを構築
            # APIが期待する形式に合わせる
            screenshot_data = {
                '_id': 'screenshot_0',  # 一時的なID
                'md5': screenshot_md5,
                's3Key': screenshot_s3_key,
                'thumbnail': thumbnail_base64,  # base64エンコードされたサムネイル
            }
            
            # ページのメインURLのIPアドレスを取得
            main_page_remote_address = {}
            try:
                from urllib.parse import urlparse
                import socket
                parsed_url = urlparse(url)
                hostname = parsed_url.hostname
                
                try:
                    main_page_ip = socket.gethostbyname(hostname)
                    main_page_remote_address = {
                        'ip': main_page_ip,
                        'port': parsed_url.port or (443 if parsed_url.scheme == 'https' else 80),
                    }
                    print(f"[pwWorker] Page main URL resolved {hostname} to {main_page_ip}")
                except socket.gaierror as e:
                    print(f"[pwWorker] Could not resolve main URL {hostname}: {e}")
                    main_page_remote_address = {
                        'ip': '127.0.0.1',
                        'port': parsed_url.port or (443 if parsed_url.scheme == 'https' else 80),
                    }
            except Exception as e:
                print(f"[pwWorker] Warning: Could not get main page remote address: {e}")
            
            scraping_result = {
                'webpage': {
                    'url': url,
                    'input': url,
                    'title': page_title,
                    'content': page_content,
                    'screenshot': screenshot_s3_key,  # メインスクリーンショット（S3キー）
                    'thumbnail': thumbnail_base64,    # サムネイル（base64）
                    'requests': requests_list,        # リクエスト配列
                    'responses': responses_list,      # レスポンス配列
                    'payloads_data': payloads_collector,  # ペイロード配列
                    'screenshots_data': [screenshot_data],  # スクリーンショット配列
                    'option': data.get('option', {}),
                    'remoteAddress': main_page_remote_address,  # メインURLのIPアドレス
                },
                'website': {
                    'url': url,
                }
            }
            
            # 結果全体をJSON形式で圧縮してS3に保存
            result_json = json_module.dumps(scraping_result)
            result_bytes = result_json.encode('utf-8')
            compressed_result = gzip.compress(result_bytes)
            
            # S3キーを作成（gz拡張子を追加）
            result_key = f"webpages/{webpage_id}/result.json.gz"
            s3.upload_buffer(compressed_result, result_key, 'application/gzip')
            print(f"[pwWorker] Compressed result uploaded to S3: {result_key}")
            
            print(f"[pwWorker] Job {job_id} completed successfully")
            print(f"  - Screenshot: {screenshot_s3_key}")
            print(f"  - Requests: {len(requests_list)}")
            print(f"  - Responses: {len(responses_list)}")
            print(f"  - Payloads: {len(payloads_collector)}")
            print(f"  - Result: {result_key}")
            
            # APIが期待する戻り値フォーマット
            return {
                'resultKey': result_key,  # APIが期待するキー
                'webpageId': webpage_id,
                'status': 'success',
                'job_id': job_id,
                'url': url,
            }
    
    except Exception as e:
        error_msg = str(e)
        print(f"[pwWorker] Error processing job {job_id}: {error_msg}")
        import traceback
        traceback.print_exc()
        
        # エラーメタデータをS3に保存
        error_data = {
            'webpageId': webpage_id,
            'job_id': job_id,
            'url': data.get('url', ''),
            'status': '',
            'error': error_msg,
        }
        
        try:
            error_key = f"webpages/{webpage_id}/error.json"
            s3.upload_json(error_data, error_key)
        except Exception as s3_err:
            print(f"[pwWorker] Failed to upload error to S3: {s3_err}")
        
        return {
            'error': error_msg,
            'webpageId': webpage_id,
            'status': 'error',
        }
