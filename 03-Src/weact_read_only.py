"""Enforce the project's read-only WeAct group at the bot send boundary."""

from functools import wraps
from hashlib import sha256


# Bind the rule to the verified chat ID without storing the real ID in Git.
READ_ONLY_CHAT_SHA256 = "b9aa79faffdabff29decac6aadac7c4621cb83551c7a69909c0cbd0ba9ab53b6"


def is_read_only_chat(chat_id: str | None) -> bool:
    return bool(chat_id) and sha256(chat_id.strip().encode("utf-8")).hexdigest() == READ_ONLY_CHAT_SHA256


def _require_writable_chat(chat_id: str) -> None:
    if is_read_only_chat(chat_id):
        raise RuntimeError("此 WeAct 群为静默群，禁止发送。")


def install(api_class) -> None:
    # Keep existing engine references to this class, including the dispatch factory.
    send_message = api_class._send_message
    send_file = api_class.send_file
    send_file_to = api_class.send_file_to

    @wraps(send_message)
    def checked_send_message(api, receive_id, msg_type, content, *, receive_id_type="chat_id", uuid=""):
        if receive_id_type == "chat_id":
            _require_writable_chat(receive_id)
        return send_message(api, receive_id, msg_type, content, receive_id_type=receive_id_type, uuid=uuid)

    @wraps(send_file)
    def checked_send_file(api, chat_id, path):
        _require_writable_chat(chat_id)
        return send_file(api, chat_id, path)

    @wraps(send_file_to)
    def checked_send_file_to(api, receive_id, receive_id_type, path):
        if receive_id_type == "chat_id":
            _require_writable_chat(receive_id)
        return send_file_to(api, receive_id, receive_id_type, path)

    api_class._send_message = checked_send_message
    api_class.send_file = checked_send_file
    api_class.send_file_to = checked_send_file_to
