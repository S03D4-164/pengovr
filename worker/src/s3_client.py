import boto3
import os
import json
from botocore.exceptions import ClientError

class S3Client:
    def __init__(self):
        """S3クライアントを初期化"""
        self.endpoint_url = os.getenv('S3_ENDPOINT', 'http://127.0.0.1:8333')
        self.access_key = os.getenv('S3_ACCESS_KEY', 'pengovr-admin')
        self.secret_key = os.getenv('S3_SECRET_KEY', 'pengovr-password')
        self.bucket = os.getenv('S3_BUCKET', 'pengovr-storage-dev')
        self.region = os.getenv('S3_REGION', 'us-east-1')
        
        print(f"[S3] Initializing S3Client with:")
        print(f"  - Endpoint: {self.endpoint_url or 'AWS S3 default'}")
        print(f"  - Bucket: {self.bucket}")
        print(f"  - Region: {self.region}")
        
        # S3クライアントを作成
        kwargs = {
            'aws_access_key_id': self.access_key,
            'aws_secret_access_key': self.secret_key,
            'region_name': self.region,
        }
        
        # エンドポイントがある場合は指定（MinIO/ローカル開発）
        if self.endpoint_url:
            kwargs['endpoint_url'] = self.endpoint_url
        
        self.client = boto3.client('s3', **kwargs)
        
        # ローカル開発時はバケット存在確認
        if self.endpoint_url:
            self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """バケットが存在することを確認（存在しなければ作成）"""
        try:
            self.client.head_bucket(Bucket=self.bucket)
            print(f"[S3] Bucket '{self.bucket}' confirmed.")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"[S3] Bucket '{self.bucket}' not found. Creating...")
                try:
                    self.client.create_bucket(Bucket=self.bucket)
                    print(f"[S3] Bucket '{self.bucket}' created successfully.")
                except ClientError as create_err:
                    print(f"[S3] Failed to create bucket: {create_err}")
                    raise
            else:
                print(f"[S3] Failed to check bucket: {e}")
                raise
    
    def upload_file(self, file_path: str, s3_key: str) -> str:
        """
        ファイルをS3にアップロード
        
        Args:
            file_path: アップロードするローカルファイルパス
            s3_key: S3内のキー（パス）
            
        Returns:
            S3キー
        """
        try:
            # ファイルが存在するか確認
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # コンテントタイプを推測
            content_type = self._get_content_type(file_path)
            
            # ファイルをアップロード
            self.client.upload_file(
                file_path,
                self.bucket,
                s3_key,
                ExtraArgs={'ContentType': content_type}
            )
            print(f"[S3] Uploaded {file_path} to s3://{self.bucket}/{s3_key}")
            return s3_key
        except Exception as e:
            print(f"[S3] Failed to upload file {file_path}: {e}")
            raise
    
    def upload_buffer(self, data: bytes, s3_key: str, content_type: str = 'application/octet-stream') -> str:
        """
        バッファをS3にアップロード
        
        Args:
            data: アップロードするバイナリデータ
            s3_key: S3内のキー（パス）
            content_type: コンテントタイプ
            
        Returns:
            S3キー
        """
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=data,
                ContentType=content_type
            )
            print(f"[S3] Uploaded buffer to s3://{self.bucket}/{s3_key}")
            return s3_key
        except Exception as e:
            print(f"[S3] Failed to upload buffer to {s3_key}: {e}")
            raise
    
    def upload_json(self, data: dict, s3_key: str) -> str:
        """
        JSONデータをS3にアップロード
        
        Args:
            data: アップロードするディクショナリ
            s3_key: S3内のキー（パス）
            
        Returns:
            S3キー
        """
        try:
            json_bytes = json.dumps(data, indent=2).encode('utf-8')
            return self.upload_buffer(json_bytes, s3_key, 'application/json')
        except Exception as e:
            print(f"[S3] Failed to upload JSON to {s3_key}: {e}")
            raise
    
    @staticmethod
    def _get_content_type(file_path: str) -> str:
        """ファイルパスからコンテントタイプを推測"""
        if file_path.endswith('.png'):
            return 'image/png'
        elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
            return 'image/jpeg'
        elif file_path.endswith('.json'):
            return 'application/json'
        elif file_path.endswith('.html'):
            return 'text/html'
        elif file_path.endswith('.txt'):
            return 'text/plain'
        else:
            return 'application/octet-stream'
