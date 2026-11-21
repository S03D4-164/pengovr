"""画像処理ユーティリティ"""
import base64
from io import BytesIO
from PIL import Image


def resize_image(image_path: str, max_width: int = 400, max_height: int = 300) -> bytes:
    """
    画像をリサイズしてbase64エンコードされたバイトを返す
    
    Args:
        image_path: 画像ファイルのパス
        max_width: 最大幅
        max_height: 最大高さ
        
    Returns:
        リサイズされた画像のバイト列
    """
    try:
        # 画像を開く
        img = Image.open(image_path)
        
        # アスペクト比を保持してリサイズ
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # バイトストリームに保存
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return img_byte_arr.getvalue()
    except Exception as e:
        print(f"[image_utils] Failed to resize image: {e}")
        # リサイズに失敗した場合は元の画像を返す
        with open(image_path, 'rb') as f:
            return f.read()


def image_to_base64(image_path: str, resize: bool = True) -> str:
    """
    画像をbase64エンコードされた文字列に変換
    
    Args:
        image_path: 画像ファイルのパス
        resize: リサイズするかどうか
        
    Returns:
        base64エンコードされた画像文字列
    """
    try:
        if resize:
            img_bytes = resize_image(image_path)
        else:
            with open(image_path, 'rb') as f:
                img_bytes = f.read()
        
        return base64.b64encode(img_bytes).decode('utf-8')
    except Exception as e:
        print(f"[image_utils] Failed to encode image to base64: {e}")
        return ""
