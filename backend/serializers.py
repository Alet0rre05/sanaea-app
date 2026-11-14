from rest_framework import serializers

from iam.models import CustomUser, Membership, TenantRole
from iam.validators import password_checks
from core.models import Tenant


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=512)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    code = serializers.RegexField(r"^\d{6}$")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=512)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    code = serializers.RegexField(r"^\d{6}$")
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=512)


class PasswordCheckSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=512)

    def to_representation(self, instance):
        return password_checks(instance.get("password", ""))


class SensitiveChangeRequestSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=["email", "backup_email", "username"])
    value = serializers.CharField(max_length=254)


class SensitiveChangeConfirmSerializer(SensitiveChangeRequestSerializer):
    code = serializers.RegexField(r"^\d{6}$")


class MembershipSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "tenant_id", "tenant_name", "role", "license_number",
                  "license_verified_at", "membership_active"]


class UserSerializer(serializers.ModelSerializer):
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["id", "email", "username", "backup_email", "first_name",
                  "last_name", "platform_role", "memberships"]
        read_only_fields = fields

    def get_memberships(self, obj):
        qs = obj.memberships.select_related("tenant").filter(
            membership_active=True, is_deleted=False
        )
        return MembershipSerializer(qs, many=True).data


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = ["id", "is_active"]


class MembershipCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(choices=TenantRole.choices)
    license_number = serializers.CharField(max_length=64, required=False, allow_blank=True)
